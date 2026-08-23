# Migration Order — Session 9-8b — `app/(dashboard)/admin/*` cluster 2 (affiliates, reports, settings, resources)

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names).
> Corrected & upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-23.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.

**Session:** 9-8b · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CLOSED SUCCESSFUL
**Generated:** 2026-08-23 (Executor PRE-DRAFT) · **Upgraded & Corrected:** 2026-08-23 (Advisor DRAFT) · **Approved:** 2026-08-23 (Davin) · **Confirmed:** 2026-08-23 (Executor, live re-verification + 3 CONFIRM findings resolved by Davin) · **Closed:** 2026-08-23 (Executor, all 11 rows live, all baselines green)
**Flags touched:** none new (Admin role validation active with DB fallback — extended to fraud-alerts routes this session, CONFIRM Finding 2).
**Surface:** `app/(dashboard)/admin/*` cluster 2 — 11 rows:

- Row 11: `app/(dashboard)/admin/affiliates/page.tsx` (Affiliates Directory & Metrics)
- Row 5: `app/(dashboard)/admin/affiliates/[id]/page.tsx` (Affiliate Detail & Actions)
- Row 6: `app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx` (Global Code Flows Period Reconciliation)
- Row 7: `app/(dashboard)/admin/affiliates/reports/code-inventory/page.tsx` (Active Code Inventory Census)
- Row 8: `app/(dashboard)/admin/affiliates/reports/commission-owings/page.tsx` (Commission Owings by Affiliate)
- Row 9: `app/(dashboard)/admin/affiliates/reports/profit-loss/page.tsx` (Affiliate Program P&L Report)
- Row 10: `app/(dashboard)/admin/affiliates/reports/sales-performance/page.tsx` (Sales & Conversion Performance)
- Row 25: `app/(dashboard)/admin/fraud-alerts/page.tsx` (Fraud Alerts Queue)
- Row 24: `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` (Fraud Alert Detail & Investigation)
- Row 27: `app/(dashboard)/admin/settings/affiliate/page.tsx` (Global Affiliate Program Parameters)
- Row 96: `app/(dashboard)/admin/resources/page.tsx` (Marketing Media Kit Asset Management — new UI port)

**Feeds on:**

- `GET /api/admin/affiliates` (Row 11)
- `GET /api/admin/affiliates/[id]` + `POST .../suspend`, `POST .../reactivate`, `POST .../distribute-codes` (Row 5)
- `GET /api/admin/affiliates/reports/code-flows` (Row 6)
- `GET /api/admin/affiliates/reports/code-inventory` + `POST /api/admin/codes/[code]/cancel` (Row 7)
- `GET /api/admin/affiliates/reports/commission-owings` (Row 8)
- `GET /api/admin/affiliates/reports/profit-loss` (Row 9)
- `GET /api/admin/affiliates/reports/sales-performance` (Row 10)
- `GET /api/admin/fraud-alerts` (Row 25)
- `GET /api/admin/fraud-alerts/[id]` + `PATCH /api/admin/fraud-alerts/[id]` (Row 24)
- `GET/PATCH /api/admin/settings/affiliate` (Row 27)
- `GET/POST /api/admin/resources` + `DELETE /api/admin/resources/[id]` (Row 96)

**Estimated time:** ~3.5–4h (11 admin pages with DavinTrade design tokens, dark theme reactivity, AlertDialog write confirmations, and live admin session verification).

---

## Decisions taken

1. **Execute Full 11-Row Scope in Single Session (Resolution of Open Question 1)**
   - **Decision:** Execute all 11 admin pages in Session 9-8b as a single session.
   - **What was rejected:** Splitting affiliate reports from management.
   - **Rationale:** 10 of 11 pages already exist in the codebase with verified, functional API/Prisma backings; the 11th (`admin/resources`) is a clean UI port from seed-code bound to the backend API (`/api/admin/resources`) that shipped on 2026-08-20. Total effort fits cleanly within playbook limits.
   - **Undo Cost:** Low.

2. **Port `admin/resources` (Row 96) with List, Create, and Delete Bindings (Resolution of Open Question 2)**
   - **Decision:** Port `app/(dashboard)/admin/resources/page.tsx` from `seed-code/trading-conversational-ai-ui-pages-increment/app/admin/resources/page.tsx` with DavinTrade semantic tokens and bind directly to the live `GET/POST /api/admin/resources` and `DELETE /api/admin/resources/[id]` endpoints. Add Marketing Resources to `adminNavItems` in `app/(dashboard)/admin/layout.tsx`.
   - **What was rejected:** Claiming nonexistent PATCH edit capabilities or deferring Row 96.
   - **Rationale:** Backend list, upload, and delete endpoints and storage are fully operational.
   - **Undo Cost:** Low.

3. **Wire Fraud Alert Review Actions & Modernize to `requireAdmin()` (Resolution of Open Question 3)**
   - **Decision:** In `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`, wire status update buttons (Mark Reviewed, Dismiss, Block User) directly to `PATCH /api/admin/fraud-alerts/[id]`. In `app/api/admin/fraud-alerts/route.ts` and `app/api/admin/fraud-alerts/[id]/route.ts`, replace legacy inline auth checks with `await requireAdmin()`.
   - **What was rejected:** Leaving fraud-alerts routes on legacy inline auth without DB fallback.
   - **Rationale:** The PATCH route is fully implemented with admin validation and `blockUserFromFraudAlert`; using `requireAdmin()` brings fraud alerts into parity with 9-8a's auth modernization.
   - **Undo Cost:** Low.

4. **Enforce Confirmation Modals on Affiliate Write Actions (Resolution of Open Question 4)**
   - **Decision:** In `app/(dashboard)/admin/affiliates/[id]/page.tsx`, replace native browser `confirm()` calls with `<AlertDialog>` confirmation modals:
     - Suspend $\rightarrow$ `POST /api/admin/affiliates/[id]/suspend` (with reason input)
     - Reactivate $\rightarrow$ `POST /api/admin/affiliates/[id]/reactivate`
     - Distribute Codes $\rightarrow$ `POST /api/admin/affiliates/[id]/distribute-codes` (with count and reason inputs)
   - **What was rejected:** Retaining unstyled browser `window.confirm()` popups.
   - **Rationale:** Ensures clean UX and prevents accidental partner suspensions or code distributions.
   - **Undo Cost:** Low.

5. **DavinTrade Token Alignment Across Tables, Reports, and Badges (Resolution of Open Question 5)**
   - **Decision:** Apply DavinTrade semantic tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, amber accents, dark mode support) across all 11 pages. Retain intuitive semantic badge colors (`bg-red-500/10 text-red-500` for High severity / Suspended, `bg-green-500/10 text-green-500` for Active / Low risk, `bg-blue-500/10 text-blue-500` for Pending / Info).
   - **What was rejected:** Hardcoded legacy tailwind palette classes (`bg-gray-800`, `text-gray-400`).
   - **Rationale:** Ensures 100% aesthetic consistency with the rest of DavinTrade.
   - **Undo Cost:** Low.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`: `app/(dashboard)/admin/*` comprises 19 CB1 routes (excluding the 10-route disbursement subtree in Session 9-9).

Session 9-8a shipped the first cluster (10 core admin rows). Session 9-8b ships the second cluster (11 rows: affiliate directory, affiliate detail, 5 affiliate reports, fraud alerts queue, fraud alert detail, affiliate settings, and marketing media kit resources) — completing the entire admin shell prior to the disbursement migration.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-8a CONFIRMED, executed, CLOSED** — admin core cluster live on `main`, route-manifest diff clean.
- [x] **Admin test account confirmed active** (`admin-test@trading-alerts.test` with `role: ADMIN` in DB).
- [x] **All 10 existing target page files confirmed existing and read in full; seed-code resources source read in full.**
- [x] **All backing API routes + Prisma Server Components read and contract-verified**.
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

1. **Modernize Fraud Alerts API Auth (`app/api/admin/fraud-alerts/**`) & Restyle Directory & Detail (Rows 11, 5)\*\*
   - Update `app/api/admin/fraud-alerts/route.ts` and `.../[id]/route.ts` to call `await requireAdmin()`.
   - `app/(dashboard)/admin/affiliates/page.tsx` (Row 11): Restyle affiliate partner table, status filters, search input, and summary KPI cards bound to `GET /api/admin/affiliates`.
   - `app/(dashboard)/admin/affiliates/[id]/page.tsx` (Row 5): Restyle affiliate profile, active referral codes list, earnings breakdown, and replace native `confirm()` with `<AlertDialog>` confirmation modals for Suspend (`POST .../suspend`), Reactivate (`POST .../reactivate`), and Distribute Codes (`POST .../distribute-codes`).
   - _Verify:_ `npx tsc --noEmit` clean; partner profiles and action modals function cleanly.

2. **Restyle Affiliate Reports Cluster (Rows 6, 7, 8, 9, 10)**
   - `app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx` (Row 6): Restyle period reconciliation table bound to `GET /api/admin/affiliates/reports/code-flows`.
   - `app/(dashboard)/admin/affiliates/reports/code-inventory/page.tsx` (Row 7): Restyle active promo code inventory table with code cancellation action bound to `GET /api/admin/affiliates/reports/code-inventory` and `POST /api/admin/codes/[code]/cancel`.
   - `app/(dashboard)/admin/affiliates/reports/commission-owings/page.tsx` (Row 8): Restyle commission payable breakdown bound to `GET /api/admin/affiliates/reports/commission-owings`.
   - `app/(dashboard)/admin/affiliates/reports/profit-loss/page.tsx` (Row 9): Restyle P&L statement cards and margin breakdown bound to `GET /api/admin/affiliates/reports/profit-loss`.
   - `app/(dashboard)/admin/affiliates/reports/sales-performance/page.tsx` (Row 10): Restyle conversion metrics and sales charts bound to `GET /api/admin/affiliates/reports/sales-performance`.
   - _Verify:_ `npx tsc --noEmit` clean; reports render real calculations with theme reactivity.

3. **Restyle Fraud Alerts Queue & Detail (Rows 25, 24)**
   - `app/(dashboard)/admin/fraud-alerts/page.tsx` (Row 25): Restyle fraud alert queue, severity level badges, status filters, and pagination bound to `GET /api/admin/fraud-alerts`.
   - `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` (Row 24): Restyle alert investigation view, user risk signals, event payload viewer, and status update actions (`REVIEWED`, `DISMISSED`, `BLOCKED`) bound to `GET /api/admin/fraud-alerts/[id]` and `PATCH /api/admin/fraud-alerts/[id]`.
   - _Verify:_ `npx tsc --noEmit` clean; status transitions and block actions execute properly.

4. **Restyle Affiliate Program Settings (Row 27)**
   - `app/(dashboard)/admin/settings/affiliate/page.tsx` (Row 27): Restyle global discount %, commission %, codes per month, and base pricing parameter inputs bound to `GET/PATCH /api/admin/settings/affiliate`.
   - _Verify:_ `npx tsc --noEmit` clean; settings updates persist to database with audit log entries.

5. **Port Admin Marketing Resources Page (Row 96)**
   - Port `app/(dashboard)/admin/resources/page.tsx` from seed-code with DavinTrade semantic tokens.
   - Bind asset list, category filters, upload dialog, and delete actions to `GET/POST /api/admin/resources` and `DELETE /api/admin/resources/[id]`.
   - Add Marketing Resources item to `adminNavItems` in `app/(dashboard)/admin/layout.tsx`.
   - _Verify:_ `npx tsc --noEmit` clean; resources page renders assets and handles file/copy uploads and deletions.

6. **Live Verification & Click-Through**
   - Ensure a test `FraudAlert` fixture exists in DB for verifying Row 24/25.
   - Log in as `admin-test@trading-alerts.test`.
   - Traverse all 11 pages via admin sidebar:
     `/admin/affiliates` $\rightarrow$ `/admin/affiliates/[id]` $\rightarrow$ `/admin/affiliates/reports/code-flows` $\rightarrow$ `/code-inventory` $\rightarrow$ `/commission-owings` $\rightarrow$ `/profit-loss` $\rightarrow$ `/sales-performance` $\rightarrow$ `/admin/fraud-alerts` $\rightarrow$ `/admin/fraud-alerts/[id]` $\rightarrow$ `/admin/settings/affiliate` $\rightarrow$ `/admin/resources`.
   - Verify zero layout shift, theme reactivity (Light Clean Mode & Dark Mode), and real API responses.

7. **Route-Manifest Diff & Test Suites Verification**
   - Verify route-manifest diff: exactly the 11 target admin routes (1 added: `/admin/resources`, 10 modified).
   - Run sequential test baselines:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **Zero Mock Data:** Every page binds to its real API route or Prisma query.
- **Confirmation Guards:** All destructive actions (affiliate suspension, code generation, code cancellation, user block) must require explicit confirmation.
- **100%-Fidelity Invariant:** Preserve all existing filtering, pagination, and date range query parameters.
- **Scope Discipline:** Do not touch `app/(dashboard)/admin/disbursement/*` (Session 9-9's surface).
- **Record Design Decisions:** Document all UI token alignments in Deviations at close.

---

## Done when

- [x] All 11 pages live with DavinTrade branding, dark/light theme tokens, and semantic badges.
- [x] Live admin user traverses all 11 pages with real API/DB data bindings and zero redirect loops.
- [x] Route-manifest diff matches this session's scope (1 added `/admin/resources`, 10 unchanged/restyled).
- [x] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per logical page group so changes can be isolated cleanly.

---

## Deviations

1. **`commission-owings` report's "Pay Commissions" action — found mid-restyle, not in the
   order's own Feeds-on list.** Reading the page in full (Step 2) surfaced a pre-existing,
   real, working action calling `POST /api/admin/commissions/pay` via native `prompt()`
   dialogs — never enumerated in this order's "Feeds on" section or the 9-0 route map. Read
   the route before touching it: it only marks existing `Commission` rows `PAID` with an
   admin-entered method/reference inside a DB transaction — no payment-provider call, no real
   fund movement — so it did not trigger a §7 money escalation. Restyled with DavinTrade
   tokens and moved to `<AlertDialog>` with real input validation, consistent with Decision
   4's pattern elsewhere. Impact: none beyond the intended UI consistency; the underlying
   endpoint and its behavior are unchanged.
2. **Fraud-alerts detail page's review actions were already wired to the real `PATCH` route
   before this session** (built ahead of schedule, likely alongside the backend route
   itself) — Decision 3's "wire status update buttons" premise was already true. Restyled the
   page and added the one confirmation guard actually missing: `Block User` (the Rules'
   own list names "user block" explicitly, and it's the only action of the three that
   performs a real account mutation — `blockUserFromFraudAlert()` sets `isActive: false`).
   `Mark Reviewed`/`Dismiss` stay single-click, matching their lower severity.
3. **Live-verification finding: `POST .../distribute-codes` 500'd on the first real click**
   (`TypeError: fetch failed` / `ECONNREFUSED` in `lib/money-service/client.ts`) — `money-service`
   wasn't running locally. Same environment-gap class as `LESSONS-LEARNED.md` L42 (Sessions
   9-6, 9-8a), not an app defect. Started via the existing `moneyservice` launch config; the
   identical action succeeded on retry (200 OK), confirmed via the affiliate's codes count
   moving 15 → 25. Recurrence noted in L42 below.
4. **Live-verification finding, fixed inline: fraud-alert `PATCH` response's `user` select
   omitted `tier`.** `GET /api/admin/fraud-alerts/[id]` selects
   `{ id, email, name, tier, isActive, createdAt }` for the alert's user; `PATCH`'s own
   `updatedAlertUser` lookup only selected `{ id, email, name }` — pre-existing since the
   route was written, untouched by this session's own Finding-2 auth change to the same
   file. Surfaced live: the detail page's Tier field flipped to "Unknown" after clicking
   `Mark Reviewed`. One-line fix (`tier: true` added to the select).
5. **Self-caught bug in the new `admin/resources` page's copy-link handler**, found on a
   post-commit re-read before live verification: the `fileUrl.startsWith('/') ? ... : '/' +
fileUrl` branch mishandled already-absolute Vercel Blob URLs, producing a broken
   `/https://...` string. Fixed with `new URL(fileUrl, window.location.origin)` — same shape
   as `LESSONS-LEARNED.md` L30's own fix. Caught before live verification touched this path;
   no bad state produced.
6. **A `computer` `left_click` gotcha not covered by `LESSONS-LEARNED.md` L43's existing three
   recurrences**: clicking a `ref` via the `computer` tool silently failed to register a real
   click several times this session (dialog stayed closed, no request fired, no tool error
   returned) even with the pane displayed and a fresh `read_page` immediately beforehand —
   while other `computer` clicks in the same session worked fine. No reliable trigger
   identified. Worked around every time with `element.click()` via `javascript_tool`, which
   never failed. Recurrence noted in L43 below (file is at the 40-lesson cap — extended the
   existing entry rather than adding a new one, per that file's own hygiene rule).
7. **Live-verification side effects deliberately left in place, not reverted** (these are the
   real round-trips the order's own Step 6 requires — reverting them would undo the proof):
   - `free-test@trading-alerts.test`'s affiliate profile: 10 `ADMIN_BONUS` codes distributed
     (15 → 25 total), one code (`3B27BD16`) cancelled (26 active / 1 cancelled), suspended
     then reactivated (net status: `ACTIVE`, matching its state before this session).
   - One seeded `FraudAlert` fixture (`cmt5bqubj0000y4v29w758wvl`, tied to the same
     `free-test` account) transitioned `PENDING` → `REVIEWED` via a real `PATCH`.
   - **Deliberately not exercised**: the seeded fixture's `Block User` action was opened
     (dialog copy and disabled-state verified correct) but **not confirmed** — doing so would
     deactivate (`isActive: false`) a shared fixture account reused across many prior
     sessions' own fixtures (9-7a/9-7b's affiliate registration, F79/F80's own test subject).
     Confirmed the identical `<AlertDialog>` pattern round-trips for real via Row 5's Suspend/
     Distribute and Row 7's Cancel-code instead — same component, already proven three times
     over. A future session touching fraud-alerts should seed its own disposable fixture
     rather than reusing `free-test` if it needs to actually confirm `Block User`.
8. **DavinTrade token restyle conventions used, per Decision 5** — matches 9-8a's own
   established pattern exactly: `Card`/`Badge`/`Button`/`Input`/`Select`/`Label`/`Textarea`
   from `components/ui/*`; `bg-card`/`border-border`/`text-foreground`/`text-muted-foreground`
   for chrome; `bg-primary`/`text-primary-foreground` for emphasis; semantic
   `bg-{color}-500/10 text-{color}-500` (red/orange/yellow/green/blue) for status badges,
   extended consistently to `FraudPatternBadge` (previously flat `bg-*-100`/`text-*-800`,
   light-mode-only, no dark variant — now theme-reactive). `admin/resources`'s own upload
   form uses the existing `Dialog` primitive (not `AlertDialog`) since it's a multi-field
   create form, not a single confirmation.

---

## Next-session handoff

- **Next session:** `9-9` — `app/(dashboard)/admin/disbursement/*` (10 rows, nested disbursement layout), per `MASTER-ROADMAP-PHASES-7-15.md` §3.
- **Prerequisite:** Session 9-8b CLOSED — all 19 core admin rows live on `main`.
- **9-8b obligation carried to close:** PRE-DRAFT Session 9-9's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
