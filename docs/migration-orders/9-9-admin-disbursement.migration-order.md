# Migration Order — Session 9-9 — `app/(dashboard)/admin/disbursement/*` (10 rows, nested layout)

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names).
> Corrected & upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-23.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.

**Session:** 9-9 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CONFIRMED
**Generated:** 2026-08-23 (Executor PRE-DRAFT) · **Upgraded & Corrected:** 2026-08-23 (Advisor DRAFT) · **Approved:** 2026-08-23 (Davin) ·
**Confirmed:** 2026-08-23 (Executor, live chat CONFIRM — 3 findings resolved by Davin, see CONFIRM Resolutions below)
**Flags touched:** none new (Admin role validation active with DB fallback).
**Surface:** `app/(dashboard)/admin/disbursement/*` nested layout and 10 rows:

- Layout: `app/(dashboard)/admin/disbursement/layout.tsx` (Disbursement Shell & Navigation)
- Row 22: `app/(dashboard)/admin/disbursement/page.tsx` (Disbursement Overview & Health)
- Row 13: `app/(dashboard)/admin/disbursement/accounts/page.tsx` (Legacy Accounts — confirmed redirect to `/admin/disbursement/recipients`)
- Row 15: `app/(dashboard)/admin/disbursement/affiliates/page.tsx` (Payable Affiliates List & Quick Pay)
- Row 14: `app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx` (Affiliate Disbursement Report & History)
- Row 16: `app/(dashboard)/admin/disbursement/audit/page.tsx` (Disbursement Audit Log)
- Row 18: `app/(dashboard)/admin/disbursement/batches/page.tsx` (Payment Batches List & Creation)
- Row 17: `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` (Batch Detail & Execution / Deletion)
- Row 19: `app/(dashboard)/admin/disbursement/config/page.tsx` (Disbursement Provider Configuration — env-based notice)
- Row 20: `app/(dashboard)/admin/disbursement/recipients/page.tsx` (Wise Payout Recipient Accounts)
- Row 21: `app/(dashboard)/admin/disbursement/transactions/page.tsx` (Disbursement Transactions Ledger)

**Feeds on:**

- `GET /api/disbursement/health` + `GET /api/disbursement/reports/summary` (Row 22)
- `redirect('/admin/disbursement/recipients')` (Row 13)
- `GET /api/disbursement/affiliates/payable` + `POST /api/disbursement/pay` (Row 15)
- `GET /api/disbursement/reports/affiliate/[affiliateId]` (Row 14)
- `GET /api/disbursement/audit-logs` (Row 16)
- `GET /api/disbursement/batches` + `POST /api/disbursement/batches/preview` (Row 18)
- `GET /api/disbursement/batches/[batchId]` + `POST .../execute`, `DELETE ...` (Row 17)
- `GET/PATCH /api/disbursement/config` (Row 19 — binds to existing endpoint; env-based notice disclosed)
- `GET /api/wise/recipients` + `GET .../requirements`, `POST .../[id]/revalidate` (Row 20)
- `GET /api/disbursement/transactions` (Row 21)

**Estimated time:** ~3.5–4h (Disbursement nested layout + 10 pages with DavinTrade design tokens, dark theme reactivity, AlertDialog write confirmations, and live admin session verification).

---

## Decisions taken

1. **Confirm Row 13 as Permanent Clean Redirect (Resolution of Open Question 1)**
   - **Decision:** Formally confirm `app/(dashboard)/admin/disbursement/accounts/page.tsx` (Row 13) as a permanent redirect to `/admin/disbursement/recipients` (established when RiseWorks was retired in favor of Wise in F42). No UI restyle is required for Row 13 beyond verifying the redirect functions cleanly.
   - **What was rejected:** Re-implementing archived RiseWorks accounts UI.
   - **Rationale:** Wise is the primary live payout provider.
   - **Undo Cost:** Low.

2. **Money Safety Protocol & AlertDialog Guard for Batch Actions (Resolution of Open Question 2)**
   - **Decision:** In `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` (Row 17), replace native `confirm()` with a detailed `<AlertDialog>` modal that clearly displays the batch number, payment count, total amount, and target provider before triggering `POST .../execute`. For live verification during this UI-BUILD session, verification must test UI rendering, transaction lists, and delete/cancel actions, or execute only on local dev Wise sandbox batches (never real funds).
   - **What was rejected:** Unconfirmed execution or live mainnet fund disbursement.
   - **Rationale:** Strict compliance with `EXECUTOR-PROTOCOL.md` §7 money safety rules; environment verified as `WISE_ENVIRONMENT=sandbox`.
   - **Undo Cost:** Low.

3. **Execute Full 10-Row Scope in Single Session (Resolution of Open Question 3)**
   - **Decision:** Execute all 10 disbursement rows in Session 9-9 as a single unified session under the `app/(dashboard)/admin/disbursement/layout.tsx` boundary.
   - **What was rejected:** Sub-splitting the disbursement layout.
   - **Rationale:** All 10 pages already exist on disk with complete backend data bindings (Prisma and Wise REST APIs). This is pure UI restyling to DavinTrade semantic tokens and confirmation modal enhancement.
   - **Undo Cost:** Low.

4. **Enforce Confirmation Modals Across Consequential Disbursement Actions & Quick Pay (Resolution of Open Question 4)**
   - **Decision:** Replace all native browser popups with `<AlertDialog>` confirmation modals across the disbursement stack:
     - Batch execute / cancel / delete on Row 17 & 18.
     - Quick Payment (`POST /api/disbursement/pay`) on Row 15.
     - Wise recipient revalidation on Row 20.
     - Global disbursement provider config update on Row 19 (with honest in-UI disclosure of env-based config behavior).
   - **What was rejected:** Direct unconfirmed button triggers.
   - **Rationale:** Protects financial configurations and batch execution states from accidental clicks.
   - **Undo Cost:** Low.

5. **DavinTrade Token Alignment & Layout Auth Guard DB Fallback (Resolution of Open Question 5)**
   - **Decision:** Restyle `app/(dashboard)/admin/disbursement/layout.tsx` and all 10 pages using DavinTrade semantic tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, theme reactivity). In `disbursement/layout.tsx`, add the DB fallback for `session.user.role === 'ADMIN'` (matching `admin/layout.tsx` from 9-8a).
   - **What was rejected:** Hardcoded legacy gray-900 palette and JWT-only role checks.
   - **Rationale:** 100% aesthetic and architectural consistency across the admin stack.
   - **Undo Cost:** Low.

---

## CONFIRM Resolutions (Davin, live chat, 2026-08-23)

CONFIRM found 3 order-vs-live-code items beyond the original 5 Decisions. Davin resolved all 3
live, in the same message as "go":

6. **Row 19 (`config`) `PATCH` honesty.** `app/api/disbursement/config/route.ts`'s `PATCH` is a
   self-documented no-op (validates, logs, returns a note — nothing persists, no audit row).
   Resolution: keep it a placeholder: the page discloses this in-UI (already partially done via
   an existing yellow notice banner and success-message copy — tightened this session to state
   plainly that **none** of `enabled`/`minimumPayout`/`batchSize` persist either, not just the
   provider selection, correcting the page's own doc-comment overclaim). No backend build.
7. **`POST /api/disbursement/pay` (Quick Payment, Row 15).** Not in the original Feeds-on list or
   Decision 4's AlertDialog enforcement list. Resolution: wrap in `<AlertDialog>` alongside the
   session's other consequential actions — folded into Decision 4's scope.
8. **`DECISION-LOG.md` size gate.** 51,947 bytes vs. the ~50KB target
   (`EXECUTOR-PROTOCOL.md` §1 step 0). Resolution: run the archival pass at Step 0 **if
   material to archive exists** — checked at session open; all resolved-flag narratives were
   already moved to `history/decisions-archive.md` by prior sessions, so no further pass was
   possible without cutting into F80's still-OPEN entry (which must stay inline per the file's
   own hygiene rule). No action taken; overage (~750 bytes, ~1.5%) is inherent to F80's required
   content, not archival backlog.

**Money Safety (reaffirmed):** the batch-execute `<AlertDialog>` displays batch number, payment
count, total amount, and provider before triggering `POST .../execute`; live testing runs only
against the local money-service's Wise **sandbox** (`WISE_ENVIRONMENT=sandbox`, Test profile
`29617748` — verified live at CONFIRM), never production credentials.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`: `app/(dashboard)/admin/disbursement/*` represents the final nested layout boundary under the admin stack (10 CB1 routes covering payment batches, transactions, payable affiliates, Wise recipients, audit logs, and configuration).

Sessions 9-8a and 9-8b shipped the 19 core admin and affiliate routes; Session 9-9 migrates the disbursement subtree, completing all 29 admin routes repo-wide ahead of Session 9-10's final Phase 9 verification.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 9-8b CONFIRMED, executed, CLOSED** — admin affiliates cluster live on `main`, route-manifest diff clean.
- [ ] **Step 0 Protocol Size Gate:** Archive closed Phase 7 entries from `DECISION-LOG.md` to `history/decisions-archive.md` to keep file near ~50KB.
- [ ] **Admin test account confirmed active** (`admin-test@trading-alerts.test` with `role: ADMIN` in DB).
- [ ] **All 10 target page files confirmed existing** and read in full.
- [ ] **All backing API routes + Wise endpoints read and contract-verified**.
- [ ] **`money-service` running locally on port 3002** with `WISE_ENVIRONMENT=sandbox`.
- [ ] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24):

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

1. **Step 0 Size Gate & Disbursement Layout Modernization (`app/(dashboard)/admin/disbursement/layout.tsx`)**
   - Perform `DECISION-LOG.md` archival pass if needed.
   - Apply DavinTrade semantic tokens to disbursement sidebar, header, active payment provider badge, and navigation items.
   - Add DB fallback for `role === 'ADMIN'` check in layout.
   - _Verify:_ `npx tsc --noEmit` clean; admin navigates to `/admin/disbursement` with active navigation state.

2. **Restyle Overview, Accounts Redirect & Config (Rows 22, 13, 19)**
   - `app/(dashboard)/admin/disbursement/page.tsx` (Row 22): Restyle system health status cards, active provider indicators, and disbursement volume summaries bound to `GET /api/disbursement/health` and `GET /api/disbursement/reports/summary`.
   - `app/(dashboard)/admin/disbursement/accounts/page.tsx` (Row 13): Verify clean redirect to `/admin/disbursement/recipients`.
   - `app/(dashboard)/admin/disbursement/config/page.tsx` (Row 19): Restyle default provider selector, auto-disburse threshold inputs, wrap save in `<AlertDialog>` and honestly disclose env-based config behavior bound to `GET/PATCH /api/disbursement/config`.
   - _Verify:_ `npx tsc --noEmit` clean; config form renders with DavinTrade tokens.

3. **Restyle Payable Affiliates & Detail Report (Rows 15, 14)**
   - `app/(dashboard)/admin/disbursement/affiliates/page.tsx` (Row 15): Restyle payable affiliates table, pending commission totals, minimum threshold badges, create-batch selection, and wrap Quick Payment (`POST /api/disbursement/pay`) in `<AlertDialog>` confirmation modal.
   - `app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx` (Row 14): Restyle partner disbursement history, payout breakdown, and statement export bound to `GET /api/disbursement/reports/affiliate/[affiliateId]`.
   - _Verify:_ `npx tsc --noEmit` clean; partner payout summaries and quick pay modal render properly.

4. **Restyle Payment Batches & Batch Detail (Rows 18, 17)**
   - `app/(dashboard)/admin/disbursement/batches/page.tsx` (Row 18): Restyle batch list table, batch status badges (`DRAFT`, `SCHEDULED`, `PROCESSING`, `COMPLETED`, `FAILED`), and batch preview creation dialog bound to `GET /api/disbursement/batches` and `POST /api/disbursement/batches/preview`.
   - `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` (Row 17): Restyle batch transaction items, audit trail history, and mount `<AlertDialog>` confirmation modals on Execute (`POST .../execute` — sandbox only) and Delete (`DELETE ...`).
   - _Verify:_ `npx tsc --noEmit` clean; batch summaries and action dialogs render properly.

5. **Restyle Wise Recipients, Transactions & Audit Logs (Rows 20, 21, 16)**
   - `app/(dashboard)/admin/disbursement/recipients/page.tsx` (Row 20): Restyle Wise recipient accounts table, bank details card, verification status badges, and add revalidation trigger with `<AlertDialog>` modal bound to `GET /api/wise/recipients` and `POST /api/wise/recipients/[id]/revalidate`.
   - `app/(dashboard)/admin/disbursement/transactions/page.tsx` (Row 21): Restyle transaction ledger table, status filters, and export button bound to `GET /api/disbursement/transactions`.
   - `app/(dashboard)/admin/disbursement/audit/page.tsx` (Row 16): Restyle audit log table, actor badges, and JSON event detail accordion bound to `GET /api/disbursement/audit-logs`.
   - _Verify:_ `npx tsc --noEmit` clean; transactions and audit logs render real DB data.

6. **Live Verification & Click-Through**
   - Ensure `money-service` is running on port 3002.
   - Log in as `admin-test@trading-alerts.test`.
   - Traverse all disbursement pages via sidebar:
     `/admin/disbursement` $\rightarrow$ `/affiliates` $\rightarrow$ `/affiliates/[affiliateId]` $\rightarrow$ `/batches` $\rightarrow$ `/batches/[batchId]` $\rightarrow$ `/recipients` $\rightarrow$ `/transactions` $\rightarrow$ `/audit` $\rightarrow$ `/config`.
   - Test redirect from `/admin/disbursement/accounts` to `/admin/disbursement/recipients`.
   - Verify zero layout shift, theme reactivity (Light Clean Mode & Dark Mode), and real API responses.

7. **Route-Manifest Diff & Test Suites Verification**
   - Verify route-manifest diff: exactly the 10 disbursement routes + 1 layout restyled.
   - Run sequential test baselines:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **Zero Mock Data:** Every page binds to its real API route, Prisma query, or Wise endpoint.
- **Money Safety Strict Rule:** Batch execution (`POST /api/disbursement/batches/[batchId]/execute`) must require explicit confirmation with batch details displayed. Live testing during UI-BUILD must run exclusively in Wise sandbox mode (never real funds).
- **100%-Fidelity Invariant:** Preserve all existing filtering, pagination, and audit log accordion viewers.
- **Scope Discipline:** Do not touch `app/(dashboard)/admin/*` outside the `disbursement/` directory.
- **Record Design Decisions:** Document all UI token alignments in Deviations at close.

---

## Done when

- [ ] All 10 disbursement pages + layout live with DavinTrade branding, dark/light theme tokens, and semantic badges.
- [ ] Row 13 confirmed functioning as a clean redirect to `/admin/disbursement/recipients`.
- [ ] Live admin user traverses all disbursement pages with real API/DB data bindings and zero redirect loops.
- [ ] Route-manifest diff matches this session's scope and nothing else.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per logical page group so changes can be isolated cleanly.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

1. **Row 20's Wise-recipient revalidate action dropped from Decision 4's scope, mid-execution.**
   `POST /api/wise/recipients/[id]/revalidate` (the order's own Feeds-on citation for this action)
   is `requireAffiliate()`-guarded and self-service-only — it derives the target recipient from
   the caller's own token, using `:id` only for an ownership check, not a lookup key. Wiring it
   into `/admin/disbursement/recipients` as-is would 403 for a non-affiliate admin or silently
   revalidate the admin's own recipient instead of the target affiliate's. Read the route before
   wiring it (per `LESSONS-LEARNED.md` L15), stopped and asked Davin live rather than build a new
   admin-scoped backend endpoint (out of this UI-BUILD session's dial) or wire the mismatched
   route anyway. Davin: drop it from this session. Registered `DECISION-LOG.md` **F81**. Row 20
   ships restyled but stays read-only for Wise recipients, matching its pre-session behavior.

---

## Next-session handoff

- **Next session:** `9-10` — Phase 9 Exit (VERIFY-RETIRE): full route-map verification, zero mock constants repo-wide, component tests rebuilt, dead codebase-1 components retired, per `MASTER-ROADMAP-PHASES-7-15.md` §3.
- **Prerequisite:** Session 9-9 CLOSED — all 29 `app/(dashboard)/admin/*` rows live on `main`.
- **9-9 obligation carried to close:** PRE-DRAFT Session 9-10's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3.
