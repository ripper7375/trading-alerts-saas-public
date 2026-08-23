# Migration Order — Session 9-8a — `app/(dashboard)/admin/*` core (overview, users, system, api-usage, errors)

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names).
> Corrected & upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-23.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.

**Session:** 9-8a · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CONFIRMED
**Generated:** 2026-08-23 (Executor PRE-DRAFT) · **Upgraded & Corrected:** 2026-08-23 (Advisor DRAFT) · **Approved:** 2026-08-23 (Davin)
**Confirmed:** 2026-08-23 (Executor) — re-verified all 10 target files + backing endpoints against live
code, ran all 5 test-suite baselines fresh (monolith `tsc` clean; `eslint` 0 errors/4 pre-existing
warnings; `test:ci` 160/160·2400/2400; money-service 62/62·526/526; operation-service 42/42·393/393
— exact match to CLAUDE.md's prior baseline). Two conflicts found at CONFIRM (rows 12/23 bound to
self-documented mock-data endpoints; `requireAdmin()` missing the DB-fallback Decision 3 gives the
layout) — both resolved live by Davin and folded into Decisions 1/3 above before execution began.
**Flags touched:** none new (Admin role validation active).
**Surface:** `app/(dashboard)/admin/*` core cluster — 10 rows:

- Row 34: `app/(dashboard)/admin/page.tsx` (Executive Overview Dashboard)
- Row 33: `app/(dashboard)/admin/users/page.tsx` (User Management List)
- Row 32: `app/(dashboard)/admin/users/[id]/page.tsx` (User Detail View)
- Row 12: `app/(dashboard)/admin/api-usage/page.tsx` (API Usage Metrics)
- Row 23: `app/(dashboard)/admin/errors/page.tsx` (Error Log Viewer)
- Row 28: `app/(dashboard)/admin/system/config-history/page.tsx` (Config Change History)
- Row 29: `app/(dashboard)/admin/system/jobs/page.tsx` (Scheduled Jobs Monitor)
- Row 30: `app/(dashboard)/admin/system/outbox/page.tsx` (Outbox Event Queue Monitor)
- Row 31: `app/(dashboard)/admin/system/terminals/page.tsx` (Active Terminal Sessions & Flask API)
- Row 94: `app/(dashboard)/admin/notifications/broadcast/page.tsx` (Broadcast Composer — disabled-dispatch preview per route map §6)
  **Feeds on:**
- `GET /api/admin/analytics` (Row 34)
- `GET /api/admin/users` (Row 33)
- Server Component direct read `prisma.user.findUnique` (Row 32)
- `GET /api/admin/api-usage` (Row 12 — binds to existing API endpoint; telemetry table migration scheduled in Phase 10/14)
- `GET /api/admin/error-logs` (Row 23 — binds to existing API endpoint; persistent log streaming scheduled in Phase 10/14)
- Server Component direct read `prisma.systemConfigHistory.findMany` (Row 28)
- `lib/admin/system-jobs.ts` + `POST /api/admin/system/jobs/[jobId]/trigger` (Row 29)
- Server Component direct read `prisma.outboxEvent.groupBy` / `findMany` + `POST /api/admin/system/outbox/retry` (Row 30)
- `GET /api/admin/system/terminals` (Row 31)
- Static client composer preview (Row 94, dispatch disabled)
  **Estimated time:** ~3.5h (10 admin core pages with DavinTrade design tokens, dark theme reactivity, and live admin session verification).

---

## Decisions taken

1. **Resolution of Data Layer Bindings for `admin/system/*` (Resolution of Open Question 1)**
   - **Decision:** Bind all 4 `admin/system/*` routes directly to their verified Server Component Prisma queries and API trigger endpoints:
     - `config-history` (Row 28): Reads real `prisma.systemConfigHistory` (rendering honest empty state if 0 rows recorded).
     - `jobs` (Row 29): Renders `SYSTEM_CRON_JOBS` from `lib/admin/system-jobs.ts` and triggers live runs via `POST /api/admin/system/jobs/[jobId]/trigger`.
     - `outbox` (Row 30): Reads real `prisma.outboxEvent` aggregation and failures, retrying via `POST /api/admin/system/outbox/retry`.
     - `terminals` (Row 31): Reads live sessions from `GET /api/admin/system/terminals`.
     - `notifications/broadcast` (Row 94): Ships as an explicitly disabled-dispatch composer preview per route map §6 (relabel button "Preview Only (Dispatch Disabled)" and do not fake delivery toasts).
   - **What was rejected:** Fabricating mock rows or building redundant REST list wrappers when Server Components query the database directly.
   - **Rationale:** Aligns with standard Next.js App Router patterns and existing codebase architecture.
   - **Undo Cost:** Low.

2. **Execute Full 10-Row Scope in Single Session (Resolution of Open Question 2)**
   - **Decision:** Execute all 10 admin core pages in Session 9-8a as a single unified session without sub-splitting.
   - **What was rejected:** Splitting into 9-8a1 and 9-8a2.
   - **Rationale:** Live codebase inspection confirms zero missing backend endpoints need to be built. All 10 pages already have working data bindings.
   - **Undo Cost:** Low.

3. **Complete `requireAdmin()` & Layout Auth Guard DB Fallback (Resolution of Open Question 3)**
   - **Decision:** In both `app/(dashboard)/admin/layout.tsx` AND `lib/auth/session.ts` (`requireAdmin()`), verify admin authorization using `session.user.role === 'ADMIN'`, falling back to a direct `prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })` check if the JWT role claim is stale.
   - **What was rejected:** Leaving `requireAdmin()` without DB fallback and causing 403 errors on admin write actions.
   - **Rationale:** Permanently protects both layout rendering and all 18 admin API routes against JWT cache latency (mirroring `requireAffiliate()`).
   - **Undo Cost:** Low.

4. **Binding Row 32 User Detail Page (Resolution of Open Question 4)**
   - **Decision:** Explicitly bind `app/(dashboard)/admin/users/[id]/page.tsx` (Row 32) using its existing Server Component `prisma.user.findUnique` query (including subscription, transaction history, and status flags).
   - **What was rejected:** Relying on raw schema citations.
   - **Rationale:** Server Component direct read matches Codebase 2 design and established monolith pattern.
   - **Undo Cost:** Low.

5. **DavinTrade Token Alignment for Admin Chrome & System Surfaces**
   - **Decision:** Restyle the admin sidebar, top bar, overview KPI cards, data tables, and status badges with DavinTrade semantic tokens (`bg-card`, `border-border`, `text-foreground`, amber accents, dark mode support). Add the Broadcast Composer (`/admin/notifications/broadcast`) to `adminNavItems`.
   - **What was rejected:** Retaining hardcoded legacy gray-900 / gray-800 utility classes.
   - **Rationale:** 100% visual consistency with the DavinTrade design system.
   - **Undo Cost:** Low.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`: `app/(dashboard)/admin/*` comprises 19 CB1 routes. Session 9-8a migrates the first cluster (10 core admin rows: executive dashboard, user management, system operations, API usage, error logging, and broadcast preview).

Session 9-8b will migrate the second cluster (affiliates management, 5 affiliate reports, affiliate program settings, fraud alerts, and marketing resources).

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-7b CONFIRMED, executed, CLOSED** — authenticated partner portal live on `main`, route-manifest diff clean (`f828967d`).
- [x] **Step 0 Protocol Size Gate:** F79's resolved entry archived to `history/decisions-archive.md` at this session's CONFIRM (52.4KB → 51.9KB; remaining overage is OPEN flags F77/F80, which the hygiene rule keeps inline).
- [x] **Admin test account confirmed active** (`admin-test@trading-alerts.test`, password `AdminPassword123!`/`TestPassword123!`, role `ADMIN` via `FIXED_TEST_ACCOUNTS`; `admin@tradingalerts.com` also available, env-gated password).
- [x] **All 10 target page files confirmed existing** and read in full (9 live + broadcast correctly absent, to be created this session; all 10 seed-code sources confirmed present).
- [x] **All backing API routes + Prisma Server Components read and contract-verified** — all real and DB-bound except rows 12/23 (self-documented mock stubs, accepted as pre-existing debt per Davin's live resolution above).
- [x] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24):

  ```powershell
  # 1. Monolith
  npx tsc --noEmit
  npx eslint app components lib hooks --max-warnings 5
  npm run test:ci

  # 2. Money service
  cd money-service; npm test -- --maxWorkers=1; cd ..

  # 3. Operation service
  cd operation-service; npm test -- --maxWorkers=1; cd ..
  ```

---

## Ordered steps

1. **Step 0: Protocol Size Gate Cleanup & `requireAdmin()` DB Fallback**
   - Archive closed entries from `DECISION-LOG.md` to keep file under target.
   - Update `lib/auth/session.ts`'s `requireAdmin()` and `app/(dashboard)/admin/layout.tsx` to include DB fallback for `role === 'ADMIN'` check.
   - Apply DavinTrade semantic tokens to admin sidebar, header, navigation links, ADMIN badge, and add Broadcast Composer to `adminNavItems`.
   - _Verify:_ `npx tsc --noEmit` clean; admin navigates to `/admin` with active navigation state.

2. **Restyle Executive Overview & Users Management (Rows 34, 33, 32)**
   - `app/(dashboard)/admin/page.tsx` (Row 34): Restyle executive KPI metric cards, MRR/ARR widgets, user growth charts, and recent activity feed bound to `GET /api/admin/analytics`. Fix pre-existing `<a>` $\rightarrow$ `<Link>` warning.
   - `app/(dashboard)/admin/users/page.tsx` (Row 33): Restyle users data table, tier filter badges (`FREE`, `PRO`), search input, and pagination bound to `GET /api/admin/users`.
   - `app/(dashboard)/admin/users/[id]/page.tsx` (Row 32): Restyle user detail profile, subscription card, transaction history table, and role/tier badges via Server Component Prisma read.
   - _Verify:_ `npx tsc --noEmit` clean; user list and detail pages render real DB records.

3. **Restyle API Usage & System Error Logs (Rows 12, 23)**
   - `app/(dashboard)/admin/api-usage/page.tsx` (Row 12): Restyle endpoint call metrics, rate limit utilization, and latency graphs bound to `GET /api/admin/api-usage`.
   - `app/(dashboard)/admin/errors/page.tsx` (Row 23): Restyle error log viewer, stack trace accordion, and severity level badges bound to `GET /api/admin/error-logs`.
   - _Verify:_ `npx tsc --noEmit` clean; error logs and usage stats render with theme reactivity.

4. **Restyle System Operations & Broadcast Preview (Rows 28, 29, 30, 31, 94)**
   - `app/(dashboard)/admin/system/config-history/page.tsx` (Row 28): Restyle config audit table via Server Component Prisma query (rendering honest empty state if zero records).
   - `app/(dashboard)/admin/system/jobs/page.tsx` (Row 29): Restyle cron job cards with "Run Now" dialog trigger bound to `POST /api/admin/system/jobs/[jobId]/trigger`.
   - `app/(dashboard)/admin/system/outbox/page.tsx` (Row 30): Restyle outbox queue status summary cards and retry action button bound to `POST /api/admin/system/outbox/retry`.
   - `app/(dashboard)/admin/system/terminals/page.tsx` (Row 31): Restyle active terminal connections and Flask service health bound to `GET /api/admin/system/terminals`.
   - `app/(dashboard)/admin/notifications/broadcast/page.tsx` (Row 94): Port broadcast composer UI with disabled dispatch button (preview mode only).
   - _Verify:_ `npx tsc --noEmit` clean; job triggers and outbox actions execute cleanly.

5. **Live Verification & Click-Through**
   - Log in as admin fixture (`admin-test@trading-alerts.test`).
   - Navigate through all 10 pages via admin sidebar:
     `/admin` $\rightarrow$ `/admin/users` $\rightarrow$ `/admin/users/[id]` $\rightarrow$ `/admin/api-usage` $\rightarrow$ `/admin/errors` $\rightarrow$ `/admin/system/config-history` $\rightarrow$ `/admin/system/jobs` $\rightarrow$ `/admin/system/outbox` $\rightarrow$ `/admin/system/terminals` $\rightarrow$ `/admin/notifications/broadcast`.
   - Verify zero layout shift, theme reactivity (Light Clean Mode & Dark Mode), and real API/DB responses.

6. **Route-Manifest Diff & Test Suites Verification**
   - Verify route-manifest diff: exactly the 10 core admin routes restyled.
   - Run sequential test baselines:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **Zero Mock Data:** Every page binds to its real API route or Prisma Server Component query.
- **Broadcast Preview Mode:** Row 94 composer must have send/dispatch explicitly disabled (preview only).
- **100%-Fidelity Invariant:** Preserve all existing filtering, pagination, and confirmation dialogs.
- **Scope Discipline:** Do not touch `admin/affiliates/*`, `admin/disbursement/*`, or `admin/fraud-alerts/*`.
- **Record Design Decisions:** Document all UI token alignments in Deviations at close.

---

## Done when

- [ ] All 10 core admin pages live with DavinTrade branding, dark/light theme tokens, and semantic badges.
- [ ] Live admin user traverses all 10 pages with real API/DB data bindings and zero redirect loops.
- [ ] Route-manifest diff matches this session's scope and nothing else.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per logical page group so changes can be isolated cleanly.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `9-8b` — `app/(dashboard)/admin/*` cluster 2 (affiliates + 5 reports + settings/affiliate + fraud-alerts + resources), per `MASTER-ROADMAP-PHASES-7-15.md` §3.
- **Prerequisite:** Session 9-8a CLOSED — admin core cluster live on `main`.
- **9-8a obligation carried to close:** PRE-DRAFT Session 9-8b's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
