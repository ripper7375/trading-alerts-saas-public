# Migration Order — Session 9-0 — Frontend Swap Contract & Decisions

> For sessions whose output is a **document or decision**, not running code: read
> `00-SKELETON-AND-RULES.md` first — §4 autonomy clause applies. **Creativity dial: Medium**
> (how you investigate is yours; what counts as evidence is not).
> Upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-22.
> Resolves `DECISION-LOG.md` **F65** (⚠ NEEDS EXPLICIT SIGN-OFF) and **F66** (⚠ NEEDS EXPLICIT SIGN-OFF on live Stripe catalog), opening Phase 9 (Frontend Stack Replacement).

**Session:** 9-0 (Frontend Swap Contract & Decisions) · **Variant:** CONTRACT · **Status:** CONFIRMED — executed, CLOSED SUCCESSFUL
**Generated:** 2026-08-21 (Executor PRE-DRAFT) · **Upgraded:** 2026-08-22 (Advisor DRAFT) · **Approved:** 2026-08-22 (Davin) · **Confirmed & executed:** 2026-08-22 (Executor)
**Flags touched:** F65 (OPEN → target RESOLVED, ⚠ NEEDS EXPLICIT SIGN-OFF), F66 (OPEN → target RESOLVED, ⚠ NEEDS EXPLICIT SIGN-OFF on live Stripe catalog)
**Target artifact:** `docs/migration-orders/frontend-swap-route-map.md` (new) — no application code this session.
**Estimated time:** ~2.5h (contract specification, route mapping across 97 rows, gap inventory, and docs reorg).

---

## Decisions taken

1. **F65 — BFF Boundary Definition (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Decision:** **Retain Next.js `app/api/**` as the permanent Backend-For-Frontend (BFF) Proxy Layer.\*\*
   - **Mechanism:** The browser client communicates exclusively with the Next.js origin (`/api/**`). Next.js route handlers read `httpOnly` NextAuth session cookies/JWTs securely on the server, acquire backend service tokens via `getOperationServiceToken()` / `getMoneyServiceToken()`, and invoke `operation-service` (port 3001) and `money-service` (port 3002) via the server-only OpenAPI clients (`operationApi`, `moneyApi` from `lib/api/`).
   - **What was rejected:** Direct browser-to-microservice communication (`NEXT_PUBLIC_*` public endpoints).
   - **Rationale:**
     1. _Auth Semantics (F45 & F30):_ NextAuth session cookies are `httpOnly` to prevent XSS token theft. Browser JavaScript has no access to session cookies. Direct calls would require exposing raw 30-day session JWEs or minting public bearer tokens in JS memory, violating F45.
     2. _Client Bundling (L6):_ `lib/api/index.ts` and `lib/api/generated/` transitively import `next/headers` (via `cookies()`) and are strictly `SERVER-ONLY`. Direct client imports would break the build under Next.js 16.
     3. _CORS & Public Attack Surface:_ Exposing microservices directly would require public domain routing and multi-origin CORS configurations, whereas internal service networking on Railway is secure and zero-egress.
     4. _Decommission Scope (Session 8-1):_ In Session 8-1, "deleting migrated routes" means removing monolithic business logic, duplicate direct DB queries, and dead endpoints while maintaining clean, typed BFF proxy route handlers.
   - **Undo Cost:** Low/Zero to maintain (current production standard); High if browser-direct were attempted.

2. **F66 — Swap Mechanism & Brand Scope (`⚠ NEEDS EXPLICIT SIGN-OFF` on Stripe Catalog)**
   - **Swap Mechanism Decision:** **Progressive Layout-Boundary Replacement (Sessions 9-1 through 9-9)** over a big-bang branch swap.
     - _Rationale:_ Codebase 2 has 93 pages and zero backend wiring. Replacing all pages at once creates massive risk, unmanageable merge conflicts, and giant debugging loops. Slicing by layout boundary allows each session (9-2 Marketing, 9-3 Auth, 9-4 Dashboard, etc.) to transplant one layout boundary + nav + data/auth bindings, verifying via route-manifest diffs and passing `test:ci`.
   - **Brand Scope Decision (Phase 9 UI):** Rebrand UI chrome, page titles, headers, footers, metadata, OG images, legal text, `manifest.json`, and email templates from "Trading Alerts" to "DavinTrade".
   - **Live Stripe Product/Price Catalog (`⚠ NEEDS EXPLICIT SIGN-OFF`):** **DO NOT modify live Stripe Dashboard product/price objects in code during Phase 9.** Live Stripe product catalog edits affect active subscriber invoices, tax receipts, and payment statements. Frontend checkout labels and pricing cards will render "DavinTrade Pro" in the UI while binding to existing Stripe Price IDs (`STRIPE_PRO_MONTHLY_PRICE_ID`). Any live Stripe Dashboard catalog name changes remain an out-of-band manual administrative action for Davin.
   - **Undo Cost:** Low. Each session is an isolated git commit on `main`.

3. **Codebase-2 Admin Pages Triage (4 Pages with No Legacy Counterpart)**
   - `admin/resources` (Row 96): **TAKE IT** into `app/(dashboard)/admin/resources/page.tsx` in Session 9-8. Its backend (`GET/POST /api/admin/resources` and `prisma.marketingAsset`) shipped on 2026-08-20 with full API support; codebase 2 provides the exact admin UI needed for marketing assets.
   - `admin/notifications/broadcast` (Row 94): **TAKE IT as a disabled-dispatch / preview admin utility in Session 9-8**, safely protected with a "Coming Soon / Connect Dispatcher" safeguard until Phase 10/14 notification pipelines are wired.
   - `admin/disbursement/settings` (Row 97): **CONSOLIDATE / INTEGRATE into Session 9-9**. In codebase 2, this is a single-form wrapper around `WiseRecipientForm` for the admin's personal payout profile; consolidate its capabilities into `admin/disbursement/config` and `/affiliate/settings/payout`, avoiding duplicate conflicting payout forms.
   - `admin/login` (Row 26): **DO NOT TAKE**. `DECISION-LOG.md` **F62** is already RESOLVED: `app/admin/login` is retired and redirects to `/login`. Codebase 2's `app/admin/login/page.tsx` must be omitted/deleted and replaced with `redirect('/login')`.
   - `app/test-api` (Row 86): **DO NOT TAKE**. Deleted from codebase 1 in Session 6-12; must not be resurrected in the swap.

4. **Session Sizing & Split Boundaries (playbook ~4h split threshold)**
   - **Session 9-7 (Affiliate Portal, 14 pages, 5 nested layouts):** Split into **9-7a** (Public / Onboarding: Landing `/affiliate`, Join `/affiliate/join`, Register `/affiliate/register`, Verify `/affiliate/verify`, Marketing Resources `/affiliate/resources`, Payout Settings `/affiliate/settings/payout` — 6 pages) and **9-7b** (`(affiliate-dashboard)` Core: Dashboard `/affiliate/dashboard`, Codes `/affiliate/dashboard/codes`, Code Inventory `/affiliate/dashboard/code-inventory`, Commissions `/affiliate/dashboard/commissions`, Payouts `/affiliate/dashboard/payouts`, Statements `/affiliate/dashboard/statements`, Profile `/affiliate/dashboard/profile`, Payment redirect `/affiliate/dashboard/profile/payment` — 8 pages).
   - **Session 9-8 (Admin Core, 19 pages):** Split into **9-8a** (Admin Directory & System: Overview `/admin`, Users `/admin/users`, User Detail `/admin/users/[id]`, System Config History `/admin/system/config-history`, Cron/Jobs `/admin/system/jobs`, Outbox `/admin/system/outbox`, Terminals `/admin/system/terminals`, API Usage `/admin/api-usage`, Errors `/admin/errors` — 9 pages) and **9-8b** (Admin Affiliates, Reports & Admin Ops: Affiliates Directory `/admin/affiliates`, Affiliate Detail `/admin/affiliates/[id]`, 5 Reports [Code Flows, Code Inventory, Commission Owings, Profit & Loss, Sales Performance], Fraud Alerts `/admin/fraud-alerts`, Fraud Detail `/admin/fraud-alerts/[id]`, Settings Affiliate `/admin/settings/affiliate`, Marketing Resources `/admin/resources` — 11 pages).

5. **Role Verification Taxonomy (Davin Confirmation)**
   - Authentication and authorization matrix covers **5 authenticated roles**:
     1. `FREE`
     2. `PRO`
     3. `AFFILIATE+FREE` (Unified Affiliate + Free user)
     4. `AFFILIATE+PRO` (Unified Affiliate + Pro user)
     5. `ADMIN`
   - Plus **`NON-LOGIN`** (public/marketing pages) verified completely and correctly for open guest access.

---

## Why this session exists

Phase 9 (Frontend Stack Replacement, `MASTER-ROADMAP-PHASES-7-15.md` §3) replaces the monolith's 85-page "Trading Alerts" frontend with `seed-code/trading-conversational-ai-ui-pages-increment/` (93 pages, "DavinTrade" brand, parity-audited, light/dark verified) — but codebase 2 has **no backend, no NextAuth, no session, and a no-op `middleware.ts`**. Supplying those against a real data layer, real auth, and real tier gates is the substance of the phase; Sessions 9-1…9-9 cannot start correctly without this session's binding decisions and route-map contract.

Per the roadmap's §6 "single biggest risk," a session that ports pages visually without binding them to real data is Session 6-1b's exact defect at ten times the scale. **Session 9-0's route map is the binding contract** preventing mock data leakage.

**Independent of F76/4A-16:** Phase 4X closed with 4A-15 (F47/F50 resolved); dLocal Group B (F76) requires its own dedicated session (`4A-16`) before Session 8-1, but Phase 9 runs immediately after Phase 4X and has zero technical dependency on dLocal.

---

## Entry criteria (draft — re-verify all at CONFIRM)

- [ ] `DECISION-LOG.md` **F65** and **F66** reviewed directly — confirm both OPEN.
- [ ] **Phase 7 confirmed CLOSED** — verify `lib/api/index.ts` exports `operationApi`/`moneyApi` client surface and is server-only.
- [ ] **Git drift check re-measured live**:
  ```powershell
  git log --oneline 8810b260..HEAD -- app/api/ lib/api/ seed-code/trading-conversational-ai-ui-pages-increment/
  ```
  Confirm no unexpected code changes in either tree.
- [ ] **Working tree on `seed-code/` checked**:
  ```powershell
  git status seed-code/
  ```
  Confirm the 2 modified files (`payouts/page.tsx`, `statements/page.tsx`) carry only the F38 fee-bearer copy alignment (`fee = 0`, `(Covered)`).
- [ ] **Source documents exist and verified**:
  - `docs/files-completion-list/frontend-codebase-migration/ui-pages-replication.xlsx` (sheet `codebase_1_vs_codebase_2`, 97 rows)
  - `docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md` + `batch-0…8`
  - `docs/files-completion-list/frontend-codebase-migration/light-dark-mode-theme-migration/`
  - `docs/files-completion-list/page-comparison-PUBLIC-VS-PAGES-INCREMENT.xlsx`
- [ ] **Test credentials & role access confirmed** (Waiting-on #117): Confirm availability of credentials/fixtures for all 5 roles (`FREE`, `PRO`, `AFFILIATE+FREE`, `AFFILIATE+PRO`, `ADMIN`) plus `NON-LOGIN` public accessibility.
- [ ] **Codebase test baselines re-measured sequentially** (`LESSONS-LEARNED.md` L24 — do not run in parallel):

  ```powershell
  # 1. Monolith
  npx tsc --noEmit
  npm run eslint -- app components lib hooks --max-warnings 5
  npm run test:ci

  # 2. Money service
  cd money-service; npm test; cd ..

  # 3. Operation service
  cd operation-service; npm test; cd ..
  ```

  Confirm all three suites pass clean.

---

## Ordered steps

_(each step = investigate → produce → verify; a claim without a source is not a finding)_

1. **Record F65 Resolution (BFF Boundary) in `DECISION-LOG.md`**
   - Record Option (a) — Server-side BFF proxy layer via Next.js `app/api/**` using `operationApi` and `moneyApi`.
   - Document security rationale (F45 `httpOnly` cookie protection), client bundling invariant (L6 server-only isolation), and Session 8-1 decommission boundary.
   - Flag for Davin's explicit sign-off.
   - _Verify:_ `DECISION-LOG.md` entry prepared and quoted in CLOSE.

2. **Record F66 Resolution (Swap Mechanism + Brand Scope) in `DECISION-LOG.md`**
   - Record Progressive Layout-Boundary Replacement across Sessions 9-1…9-9.
   - Scope the "DavinTrade" rename to all UI/metadata/email surfaces.
   - Explicitly record `⚠ NEEDS EXPLICIT SIGN-OFF` that live Stripe product/price catalog display names will NOT be mutated in code during Phase 9.
   - _Verify:_ `DECISION-LOG.md` entry prepared.

3. **Produce `docs/migration-orders/frontend-swap-route-map.md` (The 97-Row Binding Contract)**
   - Walk all 97 rows from `ui-pages-replication.xlsx` (sheet `codebase_1_vs_codebase_2`) in **both directions**:
     - _Forward:_ Every codebase-2 source file → main-repo destination (+ target layout boundary / session owner).
     - _Reverse:_ Every codebase-1 page has a destination fate (retired, superseded, or replaced).
   - Author the route map with exact columns:
     `| Row | Route Path | Codebase-2 Source File | Codebase-1 File | Main-Repo Target Path | Session Owner | Target Layout Boundary | Backing API / Data Hook | Auth Gate | Tier Gate | Effort (S/M/L) |`
   - _Verify:_ Spot-check 10 rows across all layout boundaries (Marketing, Auth, Dashboard, Settings, Payments, Affiliate, Admin, Disbursement) against the live disk tree; verify 0 unmapped rows in either direction.

4. **Inventory Wholesale Gaps in Codebase 2 & Assign Ownership**
   - Itemize all infrastructure and architectural capabilities codebase 2 lacks wholesale:
     1. NextAuth session integration & bridge token hydration (`SessionProvider` + `getOperationServiceToken`).
     2. Gated `middleware.ts` (redirecting unauthenticated users from protected surfaces, role enforcement for ADMIN and AFFILIATE).
     3. Live data fetching hooks (replacing hardcoded `useState` initializers with SWR / React Query / typed fetch calls).
     4. i18n `<T>` / `useLocale()` bindings connected to live `GET /api/user/preferences`.
     5. Error boundaries (`error.tsx`, `global-error.tsx`) and loading states (`loading.tsx`).
     6. **5 Open Batch-0 Findings:** (a) no-op `middleware.ts` gating; (b) Light Clean Mode hardcoded-dark classes across 38 files; (c) `globals.css` `--accent-foreground` light-mode contrast; (d) dead `components/header.tsx` cleanup; (e) `davintrade.com` vs `davin-trade.com` email domain consistency.
   - Assign each wholesale gap to its owning session (9-1 for shell/tokens/boundaries, 9-3 for auth, 9-4..9-9 for per-surface hooks).
   - _Verify:_ Cross-check gap list against `codebase-2-parity-audit/batch-0-shared-shell.md`.

5. **Triage Codebase-2-Only Admin Pages & Scaffolding**
   - Record explicit dispositions in `frontend-swap-route-map.md`:
     - `admin/resources` (Row 96) → **Take** in Session 9-8 (binds to live `GET/POST /api/admin/resources`).
     - `admin/notifications/broadcast` (Row 94) → **Take** in Session 9-8 with disabled mock guard.
     - `admin/disbursement/settings` (Row 97) → **Consolidate** into Session 9-9 (`admin/disbursement/config` / payout form).
     - `admin/login` (Row 26) → **Do Not Take** (retire with `redirect('/login')` per F62).
     - `app/test-api` (Row 86) → **Do Not Take** (retire per Session 6-12 deletion).
   - _Verify:_ Confirm F62 resolution in `history/decisions-archive.md`.

6. **Resolve Docs-Reorg Residuals**
   - Address the carried-forward residual from 2026-08-19 (roadmap §5): 2 unstaged doc deletions and untracked `seed-code/lovable-mobile-app/docs/`.
   - Cleanly stage or organize doc files so git working tree remains clean.
   - _Verify:_ `git status docs/` clean.

7. **Establish Session Sizing & Schedulings (9-7a/b and 9-8a/b Splits)**
   - Compute aggregate effort per layout boundary using S/M/L page estimates:
     - 9-1: Root Shell & Design System (~4h)
     - 9-2: Marketing 12 + Public 2 (~3.5h)
     - 9-3: Auth 7 (~3h)
     - 9-4: Dashboard Core 7 + Terminal + Free (~4h)
     - 9-5: Settings 11 (~3.5h)
     - 9-6: Payments Flow Cross-Boundary (~3.5h)
     - 9-7a: Affiliate Public & Onboarding 6 (~3h)
     - 9-7b: Affiliate Dashboard Core 8 (~3.5h)
     - 9-8a: Admin Directory & System 9 (~3.5h)
     - 9-8b: Admin Affiliates & Reports 11 (~4h)
     - 9-9: Admin Disbursement 10 (~3.5h)
     - 9-10: Phase 9 Exit & Verification (~3h)
   - _Verify:_ No single session exceeds the ~4h playbook threshold.

---

## Rules specific to this variant

- Ground truth priority: live code > live dashboards > recent docs > old build-orders.
- Distinguish **verified facts** from **assumptions** in `frontend-swap-route-map.md`.
- If investigation contradicts the plan/playbook/roadmap, record it as a finding and propose an amendment.
- **`seed-code/**` is strictly read-only** (`CLAUDE.md` §5).
- **Escalate money/auth decisions:** F65 and F66 (Stripe catalog) carry `⚠ NEEDS EXPLICIT SIGN-OFF`.

---

## Done when

- [x] `docs/migration-orders/frontend-swap-route-map.md` created with all 97 rows mapped in both directions (zero unmapped rows). **Not yet committed** — see Deviations #9.
- [x] F65 and F66 resolutions recorded in `DECISION-LOG.md` with Davin's sign-off quoted where required.
- [x] Codebase-2 wholesale-gap inventory complete and mapped to owning sessions 9-1…9-9.
- [x] The 4 codebase-2-only admin pages and `test-api` triaged with explicit dispositions.
- [x] Sizing splits for 9-7a/b and 9-8a/b established and recorded (9-4 additionally flagged as likely needing one too, evidence-based per Deviations).
- [x] Docs reorg residual resolved (confirmed already clean at CONFIRM — see Deviations context).
- [x] Monolith, `money-service`, and `operation-service` test suites all re-measured green.

---

## Rollback

None (read-only / document session). If any temporary test files or scratch scripts are created, remove them before close.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

1. **Waiting-on #117 (test credentials) resolved via scope narrowing, not via credentials
   materializing.** The entry criterion literally asks to confirm credentials exist; none do.
   Davin live-authorized proceeding with 9-0 as a design contract (auth-gate/tier-gate columns
   populated from code + domain knowledge, not from a live click-through) and pushed the actual
   verification requirement to Session 9-3. Recorded so a future reader doesn't assume this
   session proves live auth behavior — it doesn't.
2. **`npm run eslint` (entry criteria, Step 7) doesn't exist.** Ran `npx eslint app components lib
hooks --max-warnings 5` directly instead — same real signal (0 errors, 5 warnings, matching the
   last recorded baseline), different invocation.
3. **`npm run lint` is also broken**, independent of #2 — `next lint` has been removed from this
   Next.js version's CLI entirely (confirmed via `next --help`). New `LESSONS-LEARNED.md` L38.
   Did not fix `package.json`'s scripts — out of scope for a CONTRACT/no-code session.
4. **money-service's full-suite run showed 1 failure on the first pass**
   (`prisma.shutdown.spec.ts`, SIGTERM graceful-shutdown test, 5000ms timeout). Isolated re-run
   passed in 12s; a fresh full re-run passed clean (62/62 suites, 526/526 tests). Treated as a
   resource-contention flake, not a regression — not chased further per this variant's scope.
5. **Backing-API column precision varies by row.** Full source-level verification (reading every
   CB1 page's actual fetch calls) for all 97 rows was out of proportion for a CONTRACT session;
   backing endpoints were resolved by direct correlation against a live, complete enumeration of
   `app/api/**` (127 routes) plus domain knowledge from prior sessions' own documented work, with
   10 rows spot-checked against disk (per the order's own verify bar) and 2 real gaps (affiliate
   self-service payouts/statements; admin system jobs/outbox list routes) disclosed explicitly
   rather than papered over. Sessions 9-1…9-9 should re-verify their own rows' exact fetch/hook
   shape at build time, not treat this table as literal call-site truth.
6. **`seed-code/` drift (payouts/statements pages) confirmed intentional and kept**, per Davin's
   live instruction — broader than the order's own entry-criterion claim ("only F38 fee-bearer
   copy"); the actual diff also includes a CSV-download DOM refactor and non-fee-related rebrand
   copy. Not reverted; `seed-code/**` treated as settled source of truth going forward.
7. **`/welcome` (row 95) placed under `(auth)/layout.tsx`** as a 9-0 judgment call — the roadmap
   and census don't specify a layout boundary for it (it's a codebase-2-only page). Reasoned as
   the auth funnel's own terminal step; flagged in the route map itself (§6) as revisitable if
   9-3 finds the auth layout's guard conflicts with a post-registration/pre-dashboard state.
8. **Session 9-1's migration order was not PRE-DRAFTed this session.** EXECUTOR-PROTOCOL §3 step 5
   is a session-CLOSE duty; this session's own scope (produce the route map, resolve F65/F66) is
   complete, but the formal CLOSE ritual (PRE-DRAFT 9-1, final artifact sign-off) is left for the
   next pass rather than rushed into the same turn as a large document-production step.
9. **No git commit was made for any file this session touched.** All edits (route map, order file,
   `DECISION-LOG.md`, `CLAUDE.md`, `LESSONS-LEARNED.md`) are prepared in the working tree.
   Committing is Davin's explicit call, not assumed from "execute the order."
10. **PRE-DRAFTing Session 9-1 (same close-out pass) surfaced two real corrections to this
    session's own `frontend-swap-route-map.md`, amended directly rather than left stranded in
    9-1's order alone:** (a) a "6 Protected pages" constraint (`/`, `/terminal`, `/free`,
    `/dashboard`, `/settings/appearance`, `/settings/help` — Davin, live, 2026-08-17, per
    `codebase-2-parity-audit/00-MASTER-PLAN.md` §0) that nothing in Phase 9 planning had
    surfaced before now; (b) the route map's own gap-6e entry ("distributed — each session
    fixes its own files") was wrong — `batch-0-shared-shell.md`'s full text (only available to
    this session as a citation, not read in full until PRE-DRAFTing 9-1) shows the 38-file
    hardcoded-dark bug's root files render on 5 of the 6 Protected pages, so no downstream
    session can fix "its own files" in isolation. Both amended into `frontend-swap-route-map.md`
    §3 (items 6-8, including a third finding — a real Tailwind v3→v4 gap between the two trees)
    and §5's gap table directly, with dated addenda rather than silent edits. New
    `LESSONS-LEARNED.md` **L39** on the underlying pattern (citing a source secondhand vs.
    reading it in full).

---

## Next-session handoff

- **Next session:** `9-1` — Root Shell & Design System (UI-BUILD).
  - Scope: `app/layout.tsx`, `app/providers.tsx`, `globals.css` design tokens, Tailwind config, fonts, brand assets, `theme-provider`, appearance engine, `AppHeader`, `ChatSidebar`, marketing header/footer, and root boundaries (`not-found.tsx`, `error.tsx`, `global-error.tsx`).
- **Prerequisite:** 9-0 CLOSED — `frontend-swap-route-map.md` committed, F65/F66 resolved with Davin's sign-off.
- **9-0 obligation carried to close:** PRE-DRAFT Session 9-1's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3, informed by this session's own route-map row for the root-shell layout boundary and the Batch-0 findings this session inventories.
