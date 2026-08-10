# Migration Order — Session 6-1 — Frontend Gap Matrix & Endpoint Mapping (F11)

> **Status: CONFIRMED, executed, CLOSED — F11 stays OPEN.** PRE-DRAFTed by the Executor at
> Session 5-4 close (2026-07-23); upgraded to DRAFT by the Advisor 2026-08-10 after a full
> out-of-band UI gap analysis was completed and committed (see **Pre-computed input evidence**
> below); APPROVED by Davin 2026-08-10; CONFIRMED and executed by the Executor same day. This is
> a deliberate partial close, not a silent shortfall — see Deviations.

**Session:** 6-1 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** CONTRACT (audit; borrows
the Deviations/verification discipline of VERIFY-RETIRE) · **Status:** CONFIRMED, executed ·
**Generated:** 2026-07-23 · **Upgraded:** 2026-08-10 · **Flags touched:** F11 (resolve),
F61/F62/F63 (register) · **Estimated time:** ~2–3h (re-verification + Davin triage; the
mechanical census is already done — see below).

---

## Context & Strategy Background

- **Phase 5 closed** 2026-07-23 (Session 5-4): `next@16.2.10`, fonts, streaming, 127/127 routes.
- **Phase 4 closed-with-named-exceptions** 2026-08-04 (Session 4B-22). Two exceptions carry
  forward and are NOT this session's business: `DECISION-LOG.md` **F49** (dLocal
  `payment_method_flow`) and **F60** (Stripe webhook cutover, order `4a-13` PRE-DRAFTed).
- **Phase 6 goal (plan §8):** close the frontend↔backend feature gap now that the NestJS
  services are live and their OpenAPI contracts are the spec.
- **What changed since this order was PRE-DRAFTed:** the mechanical half of this session's work
  has already been performed out-of-band and committed. This order is therefore re-scoped from
  _"perform the census"_ to **"independently re-verify the census, extend it, and obtain Davin's
  triage."** The creativity dial stays LOW-MEDIUM: this session still builds nothing.

---

## Pre-computed input evidence (READ FIRST — but do not trust it)

Two artifacts were produced 2026-08-10 by a full sweep of `app/**/page.tsx` (57 files),
`app/api/**/route.ts` (122 endpoints), both NestJS services' controllers, all 21 OpenAPI specs,
all 33 Prisma models, and every internal `href` in `app/` + `components/`:

| Artifact            | Path                                                   | Contents                                                                                                                   |
| ------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Gap analysis report | `docs/files-completion-list/ui-page-gap-analysis.md`   | 4 user-type workflows; Section A hard gaps (18 MODIFY + 12 NEW); Section B UX gaps (22 NEW); Section C structural findings |
| Gap register        | `docs/files-completion-list/ui-page-gap-register.xlsx` | 90-row page register (EXISTING/MODIFY/NEW/RETIRE + per-user-type columns), 32 orphaned endpoints/models, 14 dead links     |

**These are INPUT, not truth.** Per `EXECUTOR-PROTOCOL.md` §1.3 and `LESSONS-LEARNED.md` L27
(order text drifts from its own cited ground truth), the Executor must re-verify every claim
against live code at CONFIRM. They were generated against the working tree at 2026-08-10;
any commit since then may have invalidated them.

**Headline findings the triage must dispose of:**

- **Baseline is 56 pages, not 54.** `ui-pages.xlsx` rows 18 and 18-5 are the same dynamic route;
  three Admin detail pages exist in code but were never registered
  (`/admin/affiliates/[id]`, `/admin/fraud-alerts/[id]`, `/admin/disbursement/batches/[batchId]`).
- **Three pages render fabricated data in production** — `/settings/billing` (zero fetch calls in
  439 lines), `/admin/fraud-alerts/[id]` (`MOCK_ALERT`), `/admin` (mock activity feed).
- **`GET /api/geo/detect` is called by two components but the route does not exist.**
- **14 dead internal links** and **no `app/not-found.tsx`** anywhere in the app.
- **23 admin pages across two incompatible trees**; 19 unreachable from the admin nav.

---

## Entry criteria

- [x] Phase 5 closed and documented in `CLAUDE.md`, `DECISION-LOG.md`, `migration-cutover-table.md`.
- [x] Phase 4 closed-with-named-exceptions (Session 4B-22, 2026-08-04) recorded in `CLAUDE.md`.
- [x] **Regression baseline re-run at CONFIRM — not fully green, recorded honestly rather than
      carrying the stale numbers.** `tsc --noEmit` clean. `test:ci` **129/129 suites, 2191/2191
      tests** — exact match to the order's own cited current baseline. `eslint app components lib
      hooks --max-warnings 0` **NOT clean** — 3 pre-existing warnings on 2 unrelated files
      (`components/layout/header.tsx`, `app/(dashboard)/admin/disbursement/batches/[batchId]/
page.tsx`), caused by an `eslint-config-next` version bump since Session 4B-21, not by this
      session or by the gap analysis. See Deviations. Not blocking (documentation-only session,
      Rule 1 forbids fixing it here).
- [x] Both pre-computed artifacts above exist at the cited paths and are readable (the `.md` was
      read and cross-checked in full; the two `.xlsx` files exist with plausible size/timestamp
      but could not be parsed in this environment — no spreadsheet-reading tool was available;
      their claims were verified via the `.md` report instead, which held up exactly).
- [x] Davin authorization (DRAFT → APPROVED) — confirmed live in chat, 2026-08-10, per the
      `LESSONS-LEARNED.md` L11 discipline (the order + 5 supporting artifacts were a single
      uncommitted rewrite with no DRAFT-stage commit trail; reported before trusting it).

---

## Rules for this session

1. **No building.** Not one component, not one route, not one bugfix — including the three
   fabricated-data pages. They are handled by Session **6-1b**, which this session PRE-DRAFTs.
   A tempting one-line fix is still scope creep (`EXECUTOR-PROTOCOL.md` §2).
2. **Re-verify before adopting.** Every row inherited from the pre-computed artifacts must be
   confirmed against live code. Report any row that no longer holds — a drifted row is a finding,
   not an embarrassment.
3. **Triage is Davin's, not the Executor's.** The Executor may recommend; only Davin assigns
   `build` / `internal-only` / `out-of-scope` to each row. Do not infer his intent from the
   priority column in the input register.
4. **Section A and Section B stay separately labelled** in the output matrix. Section A rows are
   code-backed (an endpoint/model exists with no UI); Section B rows are product judgment.
5. Anything touching money, auth semantics, or secrets → escalate (`EXECUTOR-PROTOCOL.md` §7).

---

## Ordered steps

### Step 1 — Re-verify the inherited census

Independently re-run the sweep and diff against the two input artifacts:

- Enumerate `app/**/page.tsx`, `app/api/**/route.ts`, both services' controllers, all OpenAPI
  paths, all Prisma models.
- Re-check every **orphaned endpoint** claim (32 rows) — an endpoint counts as orphaned only if
  its sole references are inside `app/api/**` itself, `app/test-api/page.tsx`, or
  `lib/api/index.ts` (known-broken by design until Phase 7 — `EXECUTOR-PROTOCOL.md` §5).
- Re-check every **mock data** claim by reading the cited line numbers.
- Re-check every **dead link** claim by resolving each `href` against the real route tree.
- Record additions, removals, and corrections in Deviations. Commit the diff, not just the result.

### Step 2 — Produce the gap matrix

Write `docs/migration-orders/phase-6-frontend-gap-matrix.md` with one row per gap:

| Column             | Meaning                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| ID                 | `A1-n` (modify), `A2-n` (new, code-backed), `B-n` (new, UX), `C-n` (structural) |
| Surface / route    | the page or component                                                           |
| User type(s)       | ADMIN / AFFILIATE / PRO / FREE / Public                                         |
| Backing evidence   | endpoint, model, OpenAPI path, or `href` reference with file:line               |
| Verified?          | re-confirmed at Step 1 — yes / drifted / removed                                |
| **Target session** | 6-1b, 6-2 … 6-11 (see the Phase 6 map below)                                    |
| **Triage**         | `build` / `internal-only` / `out-of-scope` — **Davin fills this**               |

### Step 3 — Assign each row to its target session

Phase 6 now runs **12 sessions**. The mapping below is the Advisor's proposal; the Executor
should flag any row that does not fit cleanly rather than forcing it:

| Session  | Owns                                 | Representative rows                                                                           |
| -------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| **6-1b** | Mock-data hotfix (PORT, no redesign) | A1-1 billing, A1-2 fraud detail, A1-3 admin activity, A1-4 settings counts                    |
| **6-2**  | IA + design system + shared shells   | A1-12 dead nav links, C-1 admin tree, C-3 dead links, `not-found.tsx`                         |
| **6-3**  | Alerts + charts                      | A1-11 tier endpoints, A2-4 alert edit                                                         |
| **6-4**  | Notifications                        | A2-1 `/notifications`                                                                         |
| **6-5**  | Settings / user                      | A1-9 security activity, A1-10 deletion banner, A2-2, A2-3, A2-12                              |
| **6-6**  | Admin surfaces                       | A1-5 WISE config, A1-6 RiseWorks page, A1-14 code cancel, A1-17/A2-10 user detail, A2-5, A2-7 |
| **6-7**  | Affiliate portal + reports           | A1-15 payout status, A1-16 duplicate payment page, A2-6, A2-11                                |
| **6-8**  | Payments / checkout                  | A1-7 `/api/geo/detect`, A1-8 discount validation, A2-8 return page, A2-9 upgrade success      |
| **6-10** | Public / marketing surface           | all Section B public pages, incl. legal + `/affiliate` landing                                |
| **6-11** | Admin system operations              | MT5 terminals, cron monitor, outbox monitor, config history                                   |
| **6-12** | A11y + responsive + phase exit       | final matrix sweep                                                                            |

### Step 4 — Register the three decisions this audit surfaced

Add to `DECISION-LOG.md` as OPEN, owner Davin:

- **F61 — `/api/geo/detect`:** build the missing route, or delete both call sites and fall back to
  manual country selection? Affects `/pricing` and `/checkout` conversion. Due 6-8.
- **F62 — Admin IA consolidation:** merge `app/admin/*` into `app/(dashboard)/admin/*` (one shell,
  one guard, one nav), or keep two trees and only cross-link? Structurally hard to undo. Due 6-2.
- **F63 — Public legal content ownership:** does Davin supply real copy for `/terms`, `/privacy`
  and `/disclaimer`, or does 6-10 ship reviewed placeholders? `/disclaimer` is compliance-relevant
  for a trading product. Blocks 6-10. Due before 6-10.

### Step 5 — Obtain Davin's triage

Present the matrix. Davin fills the Triage column for **every** row. Expected form:

> "Triage: rows &lt;…&gt; = build, rows &lt;…&gt; = internal-only, rows &lt;…&gt; = out-of-scope.
> Record in the matrix and Decision Log. Resolve F11."

### Step 6 — Close

Resolve **F11** with the triage recorded. Update `CLAUDE.md`, `migration-stack-analysis.md` (new
matrix artifact). Add the register-reconciliation note (56 pages, not 54) to
`docs/files-completion-list/ui-pages.xlsx`'s companion docs. PRE-DRAFT Session **6-1b**.

---

## Done when

- [x] Every inherited row re-verified against live code where feasible; drift recorded in
      Deviations. (Headline findings + ~40 of ~54 itemized rows independently re-derived; 6 rows
      explicitly flagged "not re-checked" rather than silently marked done — see the matrix's own
      "Corrections found this session" section.)
- [x] `docs/migration-orders/phase-6-frontend-gap-matrix.md` committed, every row carrying a
      target session — **Triage column is empty** (Davin's verdict was not obtained this
      session; see Deviations). This item is genuinely partial, not fully done.
- [ ] F11 RESOLVED in `DECISION-LOG.md` — **NOT done, deliberately.** F61, F62, F63 registered
      OPEN with owners and due sessions — **done** (finalized/committed this session).
- [x] The three fabricated-data pages are recorded as gaps and **left untouched**.
- [x] Regression baseline re-measured; real numbers recorded (not this order's stale figures) —
      **not fully green** (lint has 3 pre-existing warnings, see Entry criteria/Deviations).
- [x] Session 6-1b PRE-DRAFTed (PORT variant, low dial).

---

## Rollback

Documentation-only session — no code, no flags, no schema, no deploys. Rollback is
`git revert` of the matrix commit. If the triage is incomplete, the session does not close;
the matrix stays uncommitted rather than shipping half-triaged.

---

## Deviations

1. **Order authenticity (L11 recurrence).** The order's only committed version was the original
   PRE-DRAFT (`Status: PRE-DRAFT`, `Variant: AUDIT`, 2026-07-23, commit `702da51b`); the working
   copy was a full rewrite (191 lines) to `Status: APPROVED`, `Variant: CONTRACT`, with zero
   DRAFT-stage commit. The same uncommitted batch touched `CLAUDE.md`, `DECISION-LOG.md`,
   `migration-cutover-table.md`, the implementation plan, and the session playbook — all
   internally consistent. Reported to Davin before treating any of it as trustworthy; confirmed
   live as his own authentic edit via Antigravity, made 2026-08-10. Impact: none, once confirmed
   — proceeded as written.
2. **Regression baseline is not fully green.** `tsc --noEmit` clean, `test:ci` 129/129 suites /
   2191/2191 tests (exact match to the order's own cited current baseline). `eslint app
components lib hooks --max-warnings 0` found 3 warnings (0 errors) —
   `@next/next/no-location-assign-relative-destination` on `components/layout/header.tsx` (lines
   85, 89 — Session 4B-21's own deliberate full-navigation logout fix) and
   `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` (line 236, predates the
   migration, Dec 2025). Root cause: `eslint-config-next` is now `16.3.0`, newer than what 4B-21
   scope-checked against `header.tsx` alone. Neither file was touched by this session or the
   underlying gap analysis. Impact: recorded honestly rather than repeating "clean" (per
   `LESSONS-LEARNED.md` L20); not fixed here — Rule 1 ("No building... not one bugfix") forbids
   it, and both files are unrelated to this session's scope. New `LESSONS-LEARNED.md` L56.
3. **Step 1 re-verification was extensive but not exhaustive.** Every headline finding plus ~40
   of the ~54 itemized Section A/A2/C rows were independently re-derived via direct file/grep
   inspection against the live working tree — zero were found substantively wrong. Section B
   product-judgment rows (dead-link/existence claims) were checked where cheap to do so (all 14
   dead links, `not-found.tsx`/`global-error.tsx` absence, the help-page stub); 6 rows were not
   independently re-checked beyond the source artifact and are flagged as such in the matrix
   rather than silently marked "yes." Impact: high confidence in the matrix's accuracy, but the
   6 flagged rows should get a fresh look when their target sessions pick them up.
4. **Two corrections + one addition found and recorded, not silently absorbed.** (a) `A1-1`'s
   `mockInvoices` citation was off by one line (61, not "60-61"). (b) `A1-16`'s claim that
   `app/affiliate/dashboard/layout.tsx` "links to both" payment pages was imprecise — it links to
   the Profile parent page and to the new payout-settings page, not directly to the legacy page.
   (c) `lib/geo/detect-country.ts` already implements F61's needed detection logic
   (`detectCountry`/`detectCountryFromIP`), 100%-line-covered, zero importers anywhere — the
   source artifact never mentions this file. All three recorded in the matrix's own "Corrections
   found this session" section and in `DECISION-LOG.md`'s F61 entry.
5. **Step 5 (obtain Davin's triage) did not happen this session.** Assigning `build` /
   `internal-only` / `out-of-scope` to each of the matrix's ~54 rows is Davin's own product
   judgment (order Rule 3) and was neither requested of him nor fabricated by the Executor. The
   Triage column in `phase-6-frontend-gap-matrix.md` is empty throughout.
6. **Committed and pushed despite incomplete triage — a disclosed deviation from this order's own
   Rollback clause.** The Rollback section states: "If the triage is incomplete, the session does
   not close; the matrix stays uncommitted rather than shipping half-triaged." Triage is
   incomplete (Deviation 5). Davin explicitly instructed committing and pushing this session's
   work regardless, in chat, after seeing the CONFIRM report. This is recorded here as a live,
   disclosed override of the order's own stated default — not a silent shortcut either way. F11
   is NOT marked RESOLVED as a result (see Done when); the matrix itself is real and accurate,
   just untriaged.
7. **Session-history hygiene partially addressed, not fully caught up.** Per
   `EXECUTOR-PROTOCOL.md` §3's rotation rule, Session 4B-21's full CLAUDE.md entry (now two
   generations back from Current) was moved to `history/sessions-archive.md` with a short pointer
   left in place. The larger pre-existing backlog (Sessions 4B-20 back through 4B-9 and earlier,
   already flagged at this file's own Waiting-on #102) was NOT rotated — that is a multi-thousand-
   line undertaking explicitly out of this session's own scope, unchanged by this deviation.

---

## Next-session handoff

Session **6-1b** — Mock-Data Hotfix (PORT, low dial). Wire the real endpoints behind the three
fabricated-data pages plus the settings alert count. No redesign, no new components, no layout
changes — 6-5 and 6-6 do the redesign later, on pages that are by then truthful.

Carry forward as explicit entry criteria for 6-1b: the verified row set for A1-1/A1-2/A1-3/A1-4,
and confirmation that `GET /api/invoices`, `GET /api/subscription`, `POST /api/subscription/cancel`
and `GET /api/admin/fraud-alerts/[id]` still return the shapes the hotfix will bind to.
