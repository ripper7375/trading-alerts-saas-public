# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.**
> **Role Distinction:**
>
> - **In Antigravity Chat UI:** You act as **Antigravity (Advisor & Architect)** — planning, drafting migration orders, reviewing codebase decisions, guiding Davin.
> - **In Terminal CLI:** You act as **Claude Code (Executor)** in the three-role Development Chain Protocol — running shell commands, executing code edits, running unit tests, git commits.
>   Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` — **read it at the start of every session before doing anything else.**
>   The previous content of this file (Aider validation guide) moved to
>   `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

> **STANDING INSTRUCTION (Davin, 2026-07-22, NARROWED 2026-07-24 — still in force
> until Davin lifts it further):** chain-length-one originally read as "webhooks cut
> over FIRST (both providers), before 4A-7 or any Slice 4 work." **Davin confirmed
> live, 2026-07-24, that this narrows to dLocal-cutover-first**: with dLocal now
> CUT-OVER (Session 4A-5, see Current below), 4A-7/Slice 4 work is unblocked — it does
> NOT need to wait for RiseWorks. RiseWorks's own cutover (`4A-5-RW`) trails
> independently, gated on RiseWorks replying with webhook/API settings (see Waiting on).
> **Session 4A-3 (below) was an explicit, scoped exception Davin asked for directly in
> chat — Slice 1 (crons) cutover, independent of this question — not itself a lifting
> of the standing instruction.** With dLocal cut over too, Slice 3/4 BUILD work (4A-7
> onward) may now proceed; RiseWorks-specific work stays gated on `4A-5-RW`'s own entry
> criteria.

> **Ad-hoc session (2026-09-01, phase/session unchanged):** Executed
> `docs/migration-orders/adhoc-locale-i18n-compliance.migration-order.md` end to end — CONFIRMED,
> executed across 5 sequenced batches, **CLOSED SUCCESSFUL**, per `EXECUTOR-PROTOCOL.md` §6.
> Remediates the recurring "new UI ships with zero locale wiring" failure class documented in
> `docs/policies/08-locale-i18n-compliance.md` (SSOT) across the 5 most-recently-built feature
> stacks (Settings→Language page, BI Dashboards, VAT/Tax Invoicing, Affiliate Commissions,
> DavinTrade Academy + Payments), plus the §0 CRITICAL bug where the Settings page saved to the
> database but nothing ever read it back.
> **CONFIRM found the by-now-familiar L3 status-integrity pattern:** the order file and the policy
> doc it's governed by were both untracked (zero git history). Treated Davin's own chat instruction
> naming this exact order file as his live confirmation, consistent with how Sessions 14-2/14-3
> resolved the identical pattern. Baseline re-verified fresh before touching anything: `tsc
--noEmit` clean, `npm run test:ci` **165/165 suites, 2382/2382 tests**.
> **A real architecture correction found via live code, not the order's own file-grouping:** the
> order's Batch 2 grouped `kpi-summary-card.tsx` and `tax-threshold-gauge.tsx` as "Client
> Components," but neither file had a `'use client'` directive and neither does its own currency
> formatting — made them async Server Components instead (`getServerLanguage()`+`getDictionary()`),
> avoiding an unforced client-bundle increase. `ranked-country-table.tsx` and
> `top-affiliates-leaderboard.tsx` genuinely did need to become Client Components, since they format
> their own confirmed-USD columns and only `useLocale()`'s `formatCurrency()` does real per-user
> currency conversion.
> **Two new shared primitives added, not requested by name but needed to satisfy the order's own
> Decision 4** (BI dashboard money routes through `formatCurrency()`): `formatCurrencyAmount()`
> (`lib/country-config.ts`) and `getServerLocalePreferences()` (`lib/i18n/server-locale.ts`), so
> Server Component dashboard pages can convert confirmed-USD figures into the viewer's own currency
> the same way client components do. `locale-context.tsx`'s own `formatCurrency()` now delegates to
> the shared helper — verified byte-for-byte identical output, not a behavior change.
> **`LESSONS-LEARNED.md` L40 recurred 4 more times in this one session** (5th–8th occurrences
> overall): every pre-existing test file exercising a component newly wired to `useLocale()` broke
> with `useLocale must be used within a LocaleProvider` (`billing.test.tsx`,
> `commission-table.test.tsx`, `commissions-payouts.test.tsx`, `PriceDisplay.test.tsx`) — fixed each
> with the established seed-preferences-and-wrap-in-`LocaleProvider` pattern. Two of the four also
> needed real assertion updates (not just the wrapper): `formatCurrency()` rounds to 0 decimals with
> a thousands separator once an amount reaches 1000 (an existing, intentional rule, not new), so
> `"$1234.56"` is now `"$1,235"`; `formatDate()` renders the seeded date format instead of a
> hardcoded `'MMM d, yyyy'`/`en-US` shape. Recorded as an L40 recurrence, not a new lesson (at the
> 40-entry cap). Repo-wide `jest.setup.js` default mock still not built — flagged again, out of this
> order's own scope (locale wiring, not test infrastructure).
> **Repo-wide audit re-run at close, not just trusted from CONFIRM-time §6:** the order's own final
> `git diff origin/main...HEAD` audit script returned zero unhandled occurrences; additionally
> individually re-grepped all 29 files named in the policy doc's §6 inventory — 28/29 now call
> `useLocale()`/`getServerLanguage()`/`getDictionary()` directly, the one exception
> (`app/admin/dashboards/page.tsx`) being a redirect stub with zero user-facing text, left
> deliberately untouched.
> **Live-verified in a real browser, not assumed:** `/affiliate/leaderboard` and `/academy` +
> `/academy/[id]` — the only fully public surfaces among the 5 stacks — render correctly in Arabic
> with `dir="rtl"`, zero console/server errors, translated category pills/CTA/related-tutorials
> chrome. The other 8 admin/settings/checkout pages this order touches are all auth-gated;
> confirmed each compiles and redirects cleanly for an unauthenticated visitor (zero server errors)
> but full authenticated click-through was **not** performed — the Executor is categorically
> prohibited from entering credentials, including the dev login page's own test-account autofill
> buttons, matching this repo's own established handling of the identical boundary in the
> 2026-08-31 BI-dashboard and Academy ad-hoc sessions (see Waiting on).
> **Artifacts:** `app/settings/language/page.tsx`; all 7
> `components/admin/analytics/*.tsx` + 8 `app/admin/dashboards/**`/`app/affiliate/leaderboard`
> pages; `components/billing/invoice-list.tsx` + `app/settings/billing/page.tsx`;
> `components/affiliate/commission-table.tsx` + `app/affiliate/dashboard/commissions/page.tsx` +
> `app/admin/affiliates/[id]/page.tsx`; `app/(marketing)/academy/{page,[id]/page}.tsx` +
> `app/admin/tutorials/page.tsx` + all 3 `components/payments/*.tsx`; shared
> `lib/country-config.ts`, `lib/context/locale-context.tsx`, `lib/i18n/server-locale.ts`; ~250 new
> curated `ar`/`th` dictionary keys plus a handful of `en-GB`/`en-US` identity entries; 4 fixed
> pre-existing test files; `docs/policies/08-locale-i18n-compliance.md` (§6 pointer note + §8 log
> entry); `LESSONS-LEARNED.md` (L40 recurrence note); this file. 5 commits, one per batch.

> **Ad-hoc session (2026-08-30, phase/session unchanged):** Davin requested UAE (`AE`) support
> directly in chat — dLocal payment methods (Local Cards/Apple Pay/Bank Transfer, `AED`), Arabic
> (`ar`) locale, and `Asia/Dubai`/DMY/12h regional defaults — outside the Session 14-x chat-stack
> work above and outside the playbook numbering entirely, per `EXECUTOR-PROTOCOL.md` §6. Not a
> migration slice: dLocal now supports 9 countries (`IN/NG/PK/VN/ID/TH/ZA/TR/AE`) in both the
> monolith (`lib/dlocal/*`, `types/dlocal.ts`) and `money-service` (`src/dlocal/*`) in lockstep,
> plus `lib/country-config.ts`, `lib/preferences/defaults.ts` +
> `operation-service/src/users/users.schemas.ts` (`SUPPORTED_COUNTRY_CODES`, now 13),
> `lib/preferences/geo-locale.ts`, `lib/i18n/locale-resolver.ts` (`PRIMARY_COUNTRY_FOR_LANGUAGE`),
> RTL wiring in `lib/context/locale-context.tsx` (`dir="rtl"` for `ar`/`ur`), and
> `app/settings/language/page.tsx`'s standalone language/timezone/currency lists.
> **Found and fixed one real, undocumented dependency the request didn't name:**
> `components/payments/PriceDisplay.tsx` has its own `Record<DLocalCurrency, ...>` maps
> (symbols/names/fallback rates) — `tsc --noEmit` caught the missing `AED` member immediately
> (same "file 6/10 gap" class already seen in this codebase's dLocal history); fixed before
> declaring done, not deferred.
> **Scope call on `lib/i18n/dictionaries/ar.json` (new file):** en-US.json is 2270 lines, ~2190 of
> which are literal English marketing/mock-dashboard copy used as self-referencing keys (not real
> i18n plumbing). Translated all ~65 real dotted-namespace keys (`nav.*`, `settings.*`, `form.*`,
> `chart.*`, etc. — the actual `t()`-driven chrome) plus ~140 curated literal keys spanning
> navigation, dashboard, alerts, pricing, checkout, auth, and admin/affiliate screens, rather than
> forcing full 2270-key parity. Safe by design: `locale-context.tsx`'s `t()` falls back to its own
> `fallback` param or the raw key, and `get-dictionary.ts` falls back to `en-GB` wholesale — a
> partial dictionary degrades to English, it never breaks.
> **Verified:** `npx tsc --noEmit` clean on monolith, `money-service`, and `operation-service`;
> `eslint` clean on every changed file; monolith Jest **195/195** (`__tests__/lib/dlocal`,
> `__tests__/types/dlocal.test.ts`, `__tests__/api/user.test.ts`,
> `__tests__/e2e/dlocal-payment-flow.test.ts`, the last extended with an `AE` case not asked for
> but consistent with its own existing per-country parametrization); `money-service` Jest
> **112/112**. Live-verified in a real browser: `/ae` resolves `document.documentElement.lang` to
> `ar` and `dir` to `rtl` with zero console errors (confirms `SUPPORTED_COUNTRIES`-driven
> middleware prefix routing picked up `ae` with no `middleware.ts` change needed).
> `frontend/` (SEPARATE_STACK, do-not-touch per §5) has its own byte-identical dLocal
> constants/components/tests — deliberately left untouched.

> **Ad-hoc session (2026-08-30, phase/session unchanged):** Davin asked to fix the stale
> `support@davintrade.com` email flagged (not fixed) in Session 14-2's close-out, per
> `EXECUTOR-PROTOCOL.md` §6. **Scope was wider than the single page originally named** — a live
> grep (`LESSONS-LEARNED.md` L22 recurrence) found 6 `.com` email occurrences across 7 `app/`
> files, not one: `support@` in `error.tsx`, `global-error.tsx`, `(marketing)/help/page.tsx`
> (×2), `settings/help/page.tsx` (×5 incl. one doc comment); `legal@` in `(marketing)/
terms/page.tsx` (×2); `privacy@` in `(marketing)/privacy/page.tsx` (×2); `careers@` in
> `(marketing)/careers/page.tsx` (×2). All corrected to `davintrade.app` — the real domain per
> Session 14-0's live Zoho Mail confirmation, not either `.com` spelling the original Batch-0
> finding posed. One test (`__tests__/pages/marketing/public-pages.test.tsx`) asserted the old
> addresses — updated, not a fabricated-test finding, just the test encoding the bug.
> **Checked, correctly out of scope, left untouched:** `lib/email/` transactional templates
> (zero occurrences — never affected); `mobile-app/` (8 files, same `.com` pattern) — belongs to
> Phase 15, not started; `seed-code/**` (read-only per §5).
> **Verified:** `npx tsc --noEmit` clean; `public-pages.test.tsx` 13/13; full monolith `test:ci`
> **154/154 suites, 2265/2265 tests** (net-neutral vs. Session 14-2's own close baseline, same
> count — no drift); live-verified in a real browser, `/help` renders `support@davintrade.app`.
> **`frontend-swap-route-map.md` gap-inventory row 6d** (the original Batch-0 finding this closes)
> updated to RESOLVED for main-repo scope, `mobile-app/` remainder assigned to Phase 15.
> **Lesson harvested:** no new lesson (at the 40-entry cap) — recurrence note appended to **L22**
> (a flagged single-instance finding is as much a floor-not-ceiling risk as an order's own
> checklist; grep the pattern before declaring a spot-fix complete).

> **Ad-hoc session (2026-08-31, phase/session unchanged):** Davin requested the DavinTrade
> Multi-Dashboard Business Intelligence System — 5 admin-only dashboards (Revenue, User Base &
> Funnel, Regional & Tax Surveillance, Affiliate Network, Executive Command Center) synthesizing
> the 25-metric catalog in
> `davintrade-dashboard-stack/DavinTrade-Business-Intelligence-Dashboards-Implementation-Plan.md`,
> referencing the two HTML interactive prototypes
> (`davintrade-dashboards-interactive-preview.html` dark / `-light-theme.html` light) and the
> master Excel workbook (`countries-vat-and-business-dashboard.xlsx`) for UI fidelity and
> calculation accuracy. Outside the Session 14-x playbook numbering entirely, per
> `EXECUTOR-PROTOCOL.md` §6. Built via `EnterPlanMode` with an Explore agent (live-schema
> verification) and a Plan agent (implementation design) before any code was written, per
> §0's "live code wins" rule — the spec doc's own SQL/schema assumptions were largely correct but
> had real gaps, all corrected rather than silently worked around:
> **Corrected vs. the spec doc's prose (workbook is authoritative):** the "17 primary
> jurisdictions" list existed nowhere in live code (the plan's own 17-item list matches the
> workbook's "Tax Rules & Thresholds" sheet exactly, now codified in new
> `lib/admin/analytics/jurisdictions.ts`) — and within that list, `NG` has a real statutory
> threshold (NGN 25,000,000), **not** a zero-threshold/day-one-collecting jurisdiction as the
> doc's prose implied, and `HK` has no VAT/GST regime on digital services at all (excluded from
> alerting, not "collecting from day one" either) — the true zero-threshold set is 7 countries
> (`EU, KR, IN, VN, TR, PK, AE`), not 8. FX rates are static, documented-as-approximate reference
> constants (matching Metric #17's own "Approximation" framing; no live FX infra exists anywhere
> in this codebase to build on) — sourced from the workbook or `lib/country-config.ts` where
> available, with `HK`/`TW`/`KR` explicitly flagged as unsourced placeholders needing finance
> sign-off before being treated as authoritative.
> **Two consequential scope decisions escalated to Davin directly (both answered live in
> chat) rather than assumed:** (1) headline revenue Metrics #8-11 and country-sales #16 merge
> Stripe `Invoice.amountTotal` **and** completed dLocal `Payment.amountUSD` — Stripe-only would
> have silently excluded all dLocal-billed-country revenue from "Monthly Sales," given this
> codebase's heavy recent dLocal investment (9 countries). VAT/tax surveillance (#17) stays
> Invoice-only regardless — Stripe Tax/OSS is inherently Stripe-specific, dLocal countries handle
> local tax differently. (2) the existing 447-line `app/admin/page.tsx` ("System Overview": fraud
> alerts, MRR/ARR, quick actions) is left untouched rather than replaced by the new Executive
> dashboard (which the spec wanted mounted at root `/admin` too) — `/admin/dashboards/executive`
> is the canonical DB5 route instead, with one link card added into the existing page. Zero
> regression risk to existing admin workflows.
> **A real, undocumented data-quality gap found and worked around, not silently papered over:**
> `User` has no `country` field at all, and the schema's `UserSession.country` column — the
> spec's own intended source for user-geography metrics (#13/#14/#18) — is **never written by any
> live code path** (`trackSession()` in `lib/auth/session-tracker.ts` never persists it, despite
> the column existing and a working `detectCountry()` geo-IP helper existing elsewhere,
> unconnected). Built a two-tier fallback instead (`Invoice.taxCountry` → `UserSession.country`),
> which is spec-correct and free once a future session-tracking fix lands, but means FREE-tier-
> only country rankings render mostly as "Other Countries" today — documented in the route's own
> doc comment and in a UI caption, not hidden. **Fixing `session-tracker.ts` itself was explicitly
> ruled out of scope** (an auth/session-flow change, not a dashboards change) and is flagged below
> for a future session instead of being bundled in.
> **Verified, not assumed:** `npx tsc --noEmit` clean; `eslint` clean on every new/changed file;
> full monolith `npm test` **160/160 suites, 2307/2307 tests** (154/2265 baseline + this session's
> own 6 new suites/42 new tests, zero drift elsewhere) — including boundary-exact VAT-alert-level
> tests (59.9/60.0/79.9/80.0/94.9/95.0/99.9/100.0%) and "Other Countries" aggregation-correctness
> tests, the highest-value tests in the suite since an off-by-one there silently misclassifies a
> real compliance alert. **Every raw SQL query was additionally run directly against the live dev
> database** (bypassing HTTP/auth via a throwaway script, deleted after use, never committed) —
> all queries executed cleanly against real schema (table/column names, `DISTINCT ON`,
> `generate_series`, the pre-existing `v_country_trailing_12m_sales` view all confirmed valid),
> and the real (sparse) dev data — 8 users, empty `Invoice`/`Payment` tables, 2 affiliate
> profiles — behaved exactly as the "Other Countries"/empty-state design predicted, not a crash.
> **All 7 new/changed admin routes were also live-checked in a real browser** (`preview_start`,
> Turbopack dev server): every dashboard route compiles and correctly redirects an unauthenticated
> visitor to `/login?callbackUrl=...` via the inherited `app/admin/layout.tsx` RBAC check, zero
> server or console errors. **Full authenticated visual verification (rendered charts, tables,
> dark/light theming) was NOT performed** — the dev login page exposes one-click "Admin"
> test-credential autofill buttons, but entering/submitting credentials to authenticate is
> categorically off-limits regardless of whether the account is a test account; flagged for Davin
> exactly like Session 14-3's Journey B, not silently skipped (dev server left running for Davin's
> own click-through).
> **Not built, flagged rather than silently dropped:** the CSV export button shown in both
> prototypes' headers; RAG health-matrix thresholds in the Executive dashboard are a documented
> first-pass heuristic (no cutoffs exist anywhere in the spec or workbook) explicitly labeled
> "tune with Davin later," not presented as authoritative.
> **New dependency:** `recharts@2.15.4` (React-19-compatible) — no BI/general-purpose charting
> library existed (`lightweight-charts` is TradingView-candlestick-specific). Added via `pnpm add
-w` (this is a pnpm workspace; plain `npm install` fails on the `workspace:*` protocol).
> **Artifacts:**
> `lib/admin/analytics/{jurisdictions,date-windows,revenue,users,regional,affiliates,executive}.ts`,
> 5 new `app/api/admin/analytics/*/route.ts`, 7 new `components/admin/analytics/*.tsx`,
> `app/admin/dashboards/{layout,page,dashboard-tabs,revenue/page,users/page,regional/page,
affiliates/page,executive/page}.tsx`, `app/admin/layout.tsx` (nav entry), `app/admin/page.tsx`
> (link card), 6 new test files (`__tests__/api/admin-analytics-*.test.ts`,
> `__tests__/lib/admin/analytics/jurisdictions.test.ts`), `package.json`/`pnpm-lock.yaml`
> (recharts). Built and committed in 4 phased
> checkpoints (`d36771cf` foundation, `c56c5a4f` backend complete, `90da3aaa` components,
> `1f74a93c` pages+nav), each gated on green `tsc`/tests, per the approved implementation plan.

> **Ad-hoc session (2026-08-31, phase/session unchanged):** Davin requested a public **DavinTrade
> Academy** — admin-curated YouTube tutorials teaching general trading concepts and how to use the
> app, aimed at increasing awareness and funneling visitors toward PRO upgrade or the Affiliate
> Program. Outside the Session 14-x playbook numbering entirely, per `EXECUTOR-PROTOCOL.md` §6.
> Closely mirrors the existing Marketing Resources / Media Kit feature (`MarketingAsset` model →
> `lib/marketing-resources/*` → admin CRUD → admin page → public page) rather than inventing a new
> pattern — actually simpler, since a YouTube URL needs no file upload (no Vercel Blob dependency,
> plain JSON bodies instead of multipart). New `TutorialCategory` enum + `TutorialVideo` model
> (reuses the existing `MarketingAssetStatus` enum rather than duplicating it) in
> `prisma/non-market-data/schema.prisma`; `lib/tutorials/{youtube,validators,service}.ts`;
> `app/api/admin/tutorials/route.ts` (GET/POST) + `[id]/route.ts` (PATCH/DELETE — unlike the
> media-kit feature, tutorials get real edit support, since there's no file-replace complexity);
> `app/admin/tutorials/page.tsx` (CRUD console, nav entry added to `app/admin/layout.tsx`); public
> `app/(marketing)/academy/page.tsx` + `[id]/page.tsx` (Server Components calling the service layer
> directly, same pattern `app/affiliate/leaderboard/page.tsx` established this session for public
> Prisma-backed marketing content — no separate public API route); nav link added to
> `components/marketing/marketing-navbar.tsx`; CSP (`next.config.js`) extended for
> `i.ytimg.com` (thumbnails, `img-src`) and `www.youtube-nocookie.com` (embedded player,
> `frame-src`, privacy-enhanced mode). No seed data — matches the "Zero Mock Data" principle
> already stated in `app/admin/resources/page.tsx`'s own doc comment; the table starts empty and
> admins populate real content through the UI.
> **A real, undocumented scheduling hazard found and worked around, not silently pushed
> through:** `prisma migrate status` (part of the standard L6 migration-diff-and-apply procedure)
> surfaced an already-pending, never-applied migration — `20260214000000_rag_dual_memory` — sitting
> in `prisma/migrations/` ahead of this session's own new one. This is concrete, previously-missing
> evidence for the already-flagged "Phase 12 handover prompt" `Waiting on` item below (the Stack D
> RAG architecture material that landed 2026-08-30, commit `64222ef4`) — its actual migration SQL
> exists on disk, untracked in `_prisma_migrations`, still awaiting the Advisor's resolution.
> `prisma migrate deploy` applies every pending migration in history order, so running it as L6
> prescribes would have silently applied that unrelated, unreviewed migration alongside this
> session's own additive change. Not this Executor's call to make — stopped, applied this
> session's own script standalone via `prisma db execute --file <script>` instead of `migrate
deploy`, then recorded it via `prisma migrate resolve --applied <name>` so `_prisma_migrations`
> stays accurate without touching the RAG migration's pending status at all. Verified before and
> after via `prisma migrate status` (RAG migration shows pending, unchanged, both times) and a real
> query against the pooled connection (`TutorialVideo` exists, 0 rows, post-apply).
> **A real correctness bug caught and fixed before it shipped, not after:** the first-drafted
> `getPublishedTutorialById()` incremented `viewCount` as a side effect, but the detail page's
> `generateMetadata()` and its page body both need to read the same tutorial — calling it from both
> (a completely normal Next.js App Router shape) would have double-counted every real view, with no
> test or type error to catch it. Split into a pure `getPublishedTutorialById()` (safe to call
> twice per request) and a separate `incrementTutorialViewCount()`, called exactly once from the
> page body only.
> **Live browser verification blocked by an environment constraint, not an auth boundary this
> time:** unlike the BI dashboards (blocked by "cannot log in as admin"), `/academy` is fully
> public — but another chat session already had `next dev` running against this same repo's shared
> `.next` build directory, and every `next dev` instance this session tried to spin up (4 attempts,
> auto-assigned ports) died within moments of starting — `netstat` confirmed only port 3000 had an
> actual listening socket throughout, consistent with `.next/`-directory file-lock contention on
> Windows between two concurrent dev-server processes. Fixed `.claude/launch.json`'s `nextdev` entry
> with `"autoPort": true` (needed regardless, since port 3000 was already taken) but the underlying
> shared-`.next` crash persisted across every retry; stopped rather than risk disrupting the other
> session's live server by forcing a `next build` against the same directory. Verification fell
> back to `tsc --noEmit` (clean), `eslint` (clean — same pre-existing `no-img-element` warning class
> the admin resources page already carries, from the same deliberate plain-`<img>`-for-YouTube-
> thumbnails choice), and a full fresh `npm run test:ci` (**165/165 suites, 2382/2382 tests**, zero
> regressions) — plus a manual audit of the module boundary `next build` would have caught per
> `LESSONS-LEARNED.md` L2 (`lib/tutorials/service.ts`, which touches Prisma, is only ever imported
> by the two server-component pages and the two API routes, never by the client-component admin
> page — same split `lib/marketing-resources/{validators,service}.ts` already proves safe in
> production). **Flagged below, not silently skipped:** needs a real click-through once a dev
> server is free — `/academy`, `/academy/[id]`, and (same boundary as the BI dashboards) an
> authenticated `/admin/tutorials` check.
> **Built via 4 phased checkpoints** (`a9d8d5e5` foundation (schema+migration+youtube/validators),
> `501135c2` backend (service+API routes), `155b05fe` admin UI+nav, `94f2b440` public pages+navbar+
> CSP), each gated on green `tsc`/tests, mirroring the BI-dashboard session's own checkpoint
> pattern — planned via `EnterPlanMode` with an Explore pass (mapped the existing media-kit feature
> as the template) and a Plan agent pass (concrete schema/API/UI design) before any code was
> written, per §0's "live code wins" rule.

> **Ad-hoc session (2026-08-31, phase/session unchanged):** Davin asked for a read on upgrading to
> NestJS 12 (prompted by `https://github.com/nestjs/nest/releases`), outside the Session 14-x
> playbook numbering entirely, per `EXECUTOR-PROTOCOL.md` §6. Checked live code before answering
> rather than assume: `money-service`/`operation-service` were pinned to NestJS **11.1.28**,
> `railway-gateway` still on **10.4.15** — a materially different situation, treated separately.
> Live-browsed the actual `v12.0.0` and `v11.0.0` GitHub release notes (`WebFetch`/`WebSearch` were
> erroring in this environment — MiniMax model unavailable — so this ran through the Browser pane
> instead) rather than answer from training-data memory of NestJS's version history.
> **Recommended holding off v12:** freshly tagged with zero patch releases behind it yet, requires
> Node 20.19+/22.12+ which could not be confirmed against the live Railway deployment (no Railway
> CLI/dashboard access in this environment — same class of gap as prior sessions' "no Vercel CLI
> access" finding), and its lifecycle-hook-reordering / custom-pipe-signature changes touch code
> that matters most in exactly the two services this repo's own standing rule 5 says need explicit
> sign-off before any money/auth-adjacent change. Checked both services' `ConfigModule.forRoot()`
> calls directly (`app.module.ts`) and confirmed neither uses a Joi `validationSchema` — v12's
> Standard Schema config change is a non-issue here either way. Davin approved a narrower,
> same-major patch bump instead.
> **Executed:** `@nestjs/common`/`core`/`platform-express`/`testing` bumped **11.1.28 → 11.2.3** in
> both `money-service` and `operation-service`; `operation-service`'s caret-ranged
> `@nestjs/platform-socket.io`/`@nestjs/websockets` picked up the same version on `npm install`
> with no manual edit needed. Confirmed via the (also live-browsed) 11.2.0–11.2.3 changelog that
> this range is bugfixes plus additive features only, no breaking entries — unlike the v10→v11 or
> v11→v12 jumps.
> **`railway-gateway` deliberately left untouched** — still on NestJS 10.4.15. Its path to v11 is a
> real major-version migration (bundled Express v5 route-matching changes, `@nestjs/config` v3→v4,
> `@nestjs/throttler` v5→v6 — the last already de-risked in production by the other two services
> running that exact combination), not a drop-in bump; belongs in its own scoped session rather than
> riding along with this one.
> **Verified before commit:** `npx tsc --noEmit` clean in both services. `npm test`:
> `operation-service` **43/43 suites, 401/401 tests**, clean. `money-service` **62/62 suites,
> 570/570 tests**, one `prisma.shutdown.spec.ts` SIGTERM-timeout failure on the full parallel run —
> re-ran that spec alone with `--runInBand`, passed clean in ~20s. Matches `LESSONS-LEARNED.md`
> **L24**'s documented `prisma.shutdown.spec.ts` flake pattern exactly (Jest parallel-worker CPU
> contention, not a real defect); not itself logged as a new L24 occurrence in that file, since this
> was a chat advisory that became a patch bump, not a numbered session — flagged here for whoever
> next touches L24's recurrence count. `git status` after `npm install` confirmed the diff stayed
> scoped to the intended `@nestjs/*` packages only (4 changed in `money-service`, 6 in
> `operation-service`) — no source file changes needed anywhere, no breaking-change fallout.
> **Artifacts:** `money-service/package.json`, `money-service/package-lock.json`,
> `operation-service/package.json`, `operation-service/package-lock.json`, this file.

> **Ad-hoc session (2026-08-31, phase/session unchanged):** Follow-on to the same-day NestJS
> advisory above — Davin asked whether `railway-gateway` (still on NestJS **10.4.15**, flagged in
> that entry as its own future session) should also move to v11. Investigated the two specific risks
> the prior entry raised rather than assume they still applied: (1) Express v5's route-matching
> change — `railway-gateway` has exactly three routes (`@Get('health')`, `@Get('queue/stats')`,
> `@Post()` on `MarketDataController`), no wildcards or regex params, so a non-issue; (2)
> `@nestjs/config` v4's env-var-precedence reorder (live-checked its actual release notes) — the
> service has no `load:` config namespaces/factories at all (just `ConfigModule.forRoot({ isGlobal:
true })`, same bare pattern as `money-service`/`operation-service`), so nothing for the reorder to
> affect. Confirmed on npm that `@nestjs/bull@11.0.5` still pairs with the plain `bull` package (not
> a forced `bullmq` migration) and that `@nestjs/throttler` v6 was already de-risked in production by
> the other two services. With both flagged risks resolved to non-issues, recommended proceeding now
> rather than deferring to a separate formal session; Davin approved.
> **Executed:** `@nestjs/{common,core,platform-express,testing}` 10.4.15 → **11.2.3**,
> `@nestjs/config` 3.3.0 → **4.0.4**, `@nestjs/throttler` 5.2.0 → **6.5.0**, `@nestjs/bull`
> 10.2.3 → **11.0.5**, `@nestjs/cli` 10.4.9 → **11.0.24** — matching the same v11 minor line the
> other two services now run. `npm install` printed ERESOLVE warnings mid-resolution; checked the
> installed tree directly (`node_modules/@nestjs/*/package.json`, searched for nested duplicates)
> rather than trust the warning text — confirmed a clean, fully-deduped `11.2.3` tree with no
> leftover v10 copies anywhere.
> **Verified:** `npx tsc --noEmit` clean. `npm test` **3/3 suites, 23/23 tests**, matches the
> existing baseline exactly. `npm run test:e2e` **1/1 suite, 9/9 tests** — real HTTP requests
> through the live Express adapter (malformed-OHLC rejection, auth-header checks, idempotent
> re-posting, health/queue-stats endpoints), the strongest available confirmation the Express v5
> route-matching change didn't break anything here. `npm run lint` fails ("no files matching
> pattern") — confirmed via `git stash` that this reproduces identically on the pre-change code (no
> `eslint.config.js` exists in this service at all); pre-existing, unrelated to this bump, left
> untouched per scope discipline.
> **Correction to a prior-session assumption, found live rather than repeated:** the money-service/
> operation-service entry above assumed "no Railway CLI/dashboard access" by analogy with this
> repo's documented "no Vercel CLI access" gap — checked directly this time (`railway whoami`) and
> that assumption was wrong: the Railway CLI in this environment is authenticated as Davin and
> already linked to this exact project/service (`trading-alerts` → `production` →
> `railway-gateway`). Worth knowing for future sessions touching Railway-deployed services.
> **Deployed to production, not left merged-only:** `railway status` showed `railway-gateway` has no
> connected GitHub source (unlike `money-service`/`operation-service`, which auto-rebuilt from the
> two pushes above) — it's deployed via direct CLI upload, so merging to `main` alone would not have
> shipped this change. Confirmed with Davin before deploying (three options offered: deploy now via
> CLI, connect GitHub first, or hold off) — Davin chose the CLI deploy, consistent with the service's
> existing workflow. Ran `railway up --ci`; build succeeded (Nixpacks, `nest build`), deploy
> completed clean. Live-verified after rollout, not just trusted the "Deploy complete" line: hit the
> real public health endpoint (`GET https://railway-gateway-production-3796.up.railway.app/api/v1/
health` — the `api/v1` controller prefix, not a bare `/health`) and got back `200 {"status":
"healthy", "services": {"redis":"up","queue":"up","database":"up"}, "uptime": ~56s}`, the uptime
> confirming it's the fresh deployment. Whether to also connect GitHub for future auto-deploys (would
> need Watch Paths scoped to `railway-gateway/**`, since this is a monorepo) was left as Davin's own
> call, not decided here — deferred, not silently skipped.
> **Artifacts:** `railway-gateway/package.json`, `railway-gateway/package-lock.json`, this file. No
> new migration order or runbook — a CLI redeploy of an already-committed change, not a slice
> cutover.

> **Ad-hoc session (2026-08-31, phase/session unchanged):** Davin asked to connect `railway-gateway`
> to GitHub too, closing the gap the entry above deferred as "Davin's own call." Used
> `railway service source connect --repo ripper7375/trading-alerts-saas-public --branch main
--service railway-gateway` (a CLI subcommand, no browser OAuth click-through needed since the
> Railway GitHub App was already installed and authorized for this repo via `money-service`/
> `operation-service`'s own connections).
> **The exact risk this session's own earlier advisory flagged materialized immediately, not
> hypothetically:** connecting auto-triggered a build with no Root Directory set (`railway service
source connect` has no flag for it — confirmed via `--help` before connecting), and it built from
> the monorepo root instead of `railway-gateway/`: the log showed Railway's Railpack builder trying
> to `deno cache components/affiliate/index.ts`, the Next.js monolith's own code, entirely unrelated
> to this service. Build failed as a direct result — **not silently papered over or retried blindly**;
> confirmed via `railway status` and a live health-endpoint hit that production was completely
> unaffected first (Railway never cuts a failed build over — the prior good deployment kept serving,
> `200 healthy` throughout).
> **Fix required a manual step neither the CLI nor `railway config` (needs an external SDK,
> deliberately not installed for this) could do:** Root Directory is web-UI-only. Talked Davin
> through setting it to `railway-gateway` in Settings → Source (the same panel from Davin's own
> screenshot) rather than attempting it via the API blind. Davin applied the pending change via the
> UI's own "Deploy" button — confirmed this mattered, not just clicked for form: `railway redeploy`
> would only re-run the _last successful build's image_ unchanged, not a fresh build honoring a
> browser-side-drafted setting change, so the fix genuinely required that specific click, not a CLI
> shortcut.
> **Verified via CLI polling, not assumed from the UI's own success indicator:** polled
> `railway deployment list --json` every 10s until the new deployment (`4d8e54dc`) left BUILDING/
> DEPLOYING; confirmed `SUCCESS`, then independently hit the live health endpoint again —
> `200 {"status":"healthy", "services": all "up"}`, uptime ~26s confirming it was genuinely the new
> deployment serving traffic, not a cached response.
> **Left open, flagged not silently dropped:** Watch Paths are still unset (`watchPatterns: []` on
> the connected deployment) — Davin only set Root Directory this pass. Until scoped to
> `railway-gateway/**`, every push to `main` anywhere in the monorepo will trigger a rebuild attempt
> here. Low severity (a wasted/no-op rebuild, not a breakage — confirmed the same way the Root
> Directory bug was: Railway never cuts over a bad or redundant build over a good one), but real
> — flagged for Davin to set in the same Settings → Source panel when convenient, not assumed done.
> **Artifacts:** none in the repo — this session's changes live entirely in Railway's own project
> configuration (source connection, Root Directory), not in tracked files; this CLAUDE.md entry is
> the only record.

> **Ad-hoc session (2026-09-01, phase/session unchanged):** Davin reported Google/Twitter OAuth
> passing the provider's own consent screen cleanly, then rolling back to
> `https://davintrade.app/login?callbackUrl=https%3A%2F%2Fwww.davintrade.app%2Fdashboard&error=Callback`
> instead of reaching `/dashboard`. Outside the Session 14-x playbook numbering entirely, per
> `EXECUTOR-PROTOCOL.md` §6. The prior same-day commit (`9c575a93`) had already tried
> `allowDangerousEmailAccountLinking` and a post-signin `redirect()` callback normalizing apex/www
> — investigated live rather than assuming those were insufficient for the wrong reason.
> **Root cause, found in live code, not the task's own checklist order:** `lib/auth/auth-options.ts`
> defines explicit cookie options for `sessionToken`/`callbackUrl`/`csrfToken` but never defined
> `state`/`pkceCodeVerifier`/`nonce` at all — those silently fell back to NextAuth's own defaults,
> which are host-only (no `domain`). The app is reachable on both `https://davintrade.app`
> (`NEXTAUTH_URL`, fixed) and `https://www.davintrade.app`; NextAuth always builds the OAuth
> `redirect_uri` it sends to the provider from the fixed `NEXTAUTH_URL` host regardless of which
> host the user was actually on. A user who starts sign-in on `www` gets their state/PKCE cookies
> set on `www`, then gets redirected back to the apex host per the fixed `redirect_uri` — a
> different host that never receives those cookies — so NextAuth throws and it surfaces as the
> generic `error=Callback`, exactly matching the reported URL (apex error page, `www` callbackUrl
> baked into the query string from where the flow began). This also explains why the previous
> commit's fixes didn't resolve it: account-linking and the post-signin `redirect()` callback both
> run _after_ a successful callback — neither touches the state-cookie/host mismatch that happens
> during the callback itself. That prior commit's csrfToken rename (`__Host-` → `__Secure-`) was a
> correct but incomplete first step toward this same fix — `__Host-` cookies cannot carry a
> `domain` attribute at all, so that rename was necessary groundwork, but no cookie was ever given
> one.
> **Fix:** `.davintrade.app` (leading dot) `domain` added to all six auth cookies
> (`sessionToken`/`callbackUrl`/`csrfToken`/`state`/`pkceCodeVerifier`/`nonce` — the last three now
> explicitly defined rather than left to defaults), so a cookie set on either host is valid on both.
> **Gated on `VERCEL_ENV`, deliberately not `NODE_ENV`** — Vercel sets `NODE_ENV=production` for
> preview deployments too (`*.vercel.app`), and a `.davintrade.app` Domain attribute on a
> `vercel.app` host is invalid; browsers silently drop such a cookie rather than erroring, which
> would have broken OAuth on every preview deploy. `VERCEL_ENV` is `'production'` only for the real
> davintrade.app deployment, so `COOKIE_DOMAIN` is `undefined` (host-only, unchanged behavior)
> everywhere else, local dev included. **Deliberately not `trustHost: true`** — that alternative
> fix (build `redirect_uri` from the actual request host instead) would additionally require both
> `https://davintrade.app/api/auth/callback/{provider}` and
> `https://www.davintrade.app/api/auth/callback/{provider}` to be registered as authorized redirect
> URIs in the Google/Twitter/LinkedIn OAuth app consoles — dashboards the Executor has no access to
> and couldn't verify — where the cookie-domain fix is fully self-contained in code and requires no
> external provider-side change.
> **Also added, per the task's own ask (checklist item B2):** `CustomPrismaAdapter`'s `linkAccount`
> and `getUserByAccount` were previously unwrapped passthroughs to the base Prisma adapter — any
> failure there during the OAuth callback bubbled up as a bare `error=Callback` with nothing in the
> server logs. Wrapped both with the same try/catch+console.error pattern `createUser` already used,
> so a future failure (schema drift, DB error) is diagnosable from Vercel logs directly instead of
> requiring another investigation session.
> **Checked and ruled out, not left unexamined:** `prisma/non-market-data/schema.prisma`'s
> `User`/`Account`/`Session`/`VerificationToken` models match `@next-auth/prisma-adapter`'s expected
> shape exactly (composite `@@unique([provider, providerAccountId])` present, all OAuth-nullable
> fields correctly nullable) — no schema mismatch found. `middleware.ts` does not redirect between
> apex/www (matcher runs on `/api/auth/*` too, but `isProtectedPath()` only gates
> `/dashboard|/alerts|/charts|/settings|/admin|/notifications|/affiliate`, never `/api/auth/*`) — not
> the mechanism here. `lib/csrf.ts`'s `validateOrigin()` already allows the current request's own
> host dynamically, not just the fixed `NEXTAUTH_URL` — not implicated. Email/password login
> (`callbacks.signIn`'s `credentials` branch, `app/api/auth/token-login/route.ts`) was not reported
> broken and needed no change; not deep-dived beyond confirming its own test suite still passes.
> **Verified:** `npx tsc --noEmit` clean; `eslint lib/auth/auth-options.ts` clean; full monolith
> `npm run test:ci` **165/165 suites, 2382/2382 tests** — exact match to the locale-i18n-compliance
> session's own close baseline immediately above, zero drift. Local `next dev` (single-host
> `localhost`, `VERCEL_ENV` unset) confirmed the app boots clean post-change and `/api/auth/providers`
>
> - `/api/auth/csrf` both return 200 with zero server/console errors — the httpOnly cookies aren't
>   readable from `document.cookie`, confirming `httpOnly: true` survived the rewrite rather than
>   being dropped by omission.
>   **Not verified, flagged rather than assumed:** the actual apex/www dual-host OAuth round-trip
>   cannot be reproduced on `localhost` (only one host exists there — `COOKIE_DOMAIN` is correctly
>   `undefined` in that environment by design). This needs a real deploy to production and a live
>   Google/Twitter/LinkedIn sign-in click-through from **both** `davintrade.app` and
>   `www.davintrade.app` starting points — the Executor cannot perform this itself, per this file's
>   own standing rule that it never enters OAuth/login credentials, matching every prior session's
>   identical "Journey B" boundary (see Waiting on).
>   **Artifacts:** `lib/auth/auth-options.ts` (cookie `domain` wiring + adapter diagnostic logging),
>   this file. Not yet committed — left for Davin's review of this entry before it becomes a commit,
>   consistent with this file's own established CONFIRM-before-commit pattern.

> **Ad-hoc session (2026-09-01, same day, phase/session unchanged) — correction to the entry
> immediately above:** the cookie-domain fix above was real, necessary groundwork, but Davin
> confirmed live in chat it did **not** fix the actual reported bug — `error=Callback` persisted
> after that fix deployed. **Live production testing (browser-driven, stopping short of entering
> any credentials) found the actual mechanism was entirely different from what the prior entry
> diagnosed:** navigating to the apex domain 308-redirects to `www.davintrade.app` at the Vercel/DNS
> edge, before any application code runs — the whole OAuth round trip (initiation, Google's
> `redirect_uri`, the callback) happens on one consistent host every time. The apex/www split
> never actually occurs in practice; that half of the prior diagnosis was wrong.
> **The real root cause, surfaced only once Davin pulled the actual Vercel runtime logs** (the
> `[OAuth]`/`[SignIn]` diagnostic logging added in the entry above): `PrismaClientKnownRequestError
P2022 — The column User.profile does not exist in the current database`, thrown by
> `getUserByAccount`'s very first `prisma.account.findUnique({ include: { user: true } })` call —
> every single OAuth sign-in died there, before ever reaching adapter linking logic, `signIn`, or
> `jwt`. **`User.profile` (`Json?`, added for the Session 11-3 AI Token Metering feature) was never
> captured in any tracked Prisma migration** — it was applied directly to some database via
> `db push`/manual SQL outside migration history at some point, so `prisma migrate deploy` alone
> could never have caught this either; there was nothing in `prisma/migrations/` to deploy.
> **A second, deeper untracked-drift layer found while investigating, not assumed:** replaying all
> 14 (at the time) tracked migrations from empty into a disposable shadow database (created and
> dropped on the same Postgres server, zero real data touched) failed partway through
> `20260831061759_add_tutorial_videos` — `type "MarketingAssetStatus" does not exist`. That enum,
> its sibling `MarketingAssetCategory`, and the entire `MarketingAsset` table (the Marketing
> Resources / Media Kit feature) were **also** never captured in any migration — same drift class,
> earlier and separate incident. Confirmed directly against a database where the feature is known
> live and working (read-only introspection) to get the exact column/index shape before writing
> anything.
> **A third finding, load-bearing for the whole session, not merely academic:** the "railway"
> Postgres this Executor could reach via the repo's own `.env.local` turned out to be a **separate
> Railway project literally named "postgre for staging"** — not production at all. Discovered only
> because Davin screenshotted the Railway dashboard directly; every check this session ran against
> that connection (schema structure, `migrate status`, the shadow-DB replay) was accurate about
> _that_ database but told us nothing about production's actual state. Production lives in the
> "trading-alerts" Railway project instead, and its `DATABASE_URL` there is Railway's **internal**
> address (`postgres.railway.internal`) — unreachable from outside Railway's network entirely
> (Vercel included), so Vercel's own copy must run through `DATABASE_PUBLIC_URL` / the project's
> `pgbouncer` service instead. Also found live, not assumed: `vercel env pull` cannot retrieve
> `DATABASE_URL`/`DIRECT_URL` at all once a Vercel env var is marked Sensitive — the CLI writes a
> `[SENSITIVE]` placeholder instead of the real value, by design, permanently. Davin retrieved the
> real production connection string directly from Railway's own dashboard instead (Railway, not
> Vercel, is the value's actual source of truth) and pasted it only into a local, gitignored
> `.env.production.local` — never into this chat.
> **Both migrations applied directly to production** via `prisma migrate deploy`, run by Davin from
> his own machine against a throwaway `prisma.production-check.config.ts` (pointed at
> `.env.production.local` specifically, since the repo's real `prisma.config.ts` loads `.env.local`
> with `override: true` and would otherwise silently substitute the staging credential for whatever
> was set beforehand) — six migrations total applied cleanly in one pass:
> `vat_tax_invoicing_stack`, `commission_clawback_link`, `commission_recurring_invoice_id`,
> `backfill_marketing_assets`, `add_tutorial_videos`, `add_user_profile_column`. The first three
> were pre-existing, unrelated pending migrations discovered as a side effect of finally checking
> production's real status (dating back to 2026-08-29) — each independently reviewed for
> safety (self-contained `CREATE TABLE`, or nullable-column `ALTER TABLE` on an existing table, no
> external dependencies) before deploying rather than trusting migration count alone.
> **Verified after deploy, not assumed:** `prisma migrate status` against production reports "up to
> date"; Davin confirmed live, in his own browser, that both Google and Twitter/X sign-in now work
> end to end. This Executor independently re-checked `/affiliate/leaderboard` and `/academy` (the
> latter reads the now-created `TutorialVideo` table) — both render live data, zero console/server
> errors, confirming the six-migration deploy caused no regression elsewhere.
> **Lesson harvested:** no new lesson promoted (file's own 40-entry cap) — worth flagging to the
> Advisor for a future consolidation pass regardless: this session found _three_ separate instances
> of the same failure class (`db push` bypassing migration tracking, leaving a database durably
> ahead of `prisma/migrations/`) across three unrelated features (AI Token Metering, Marketing
> Resources, and whatever produced the staging/production project split itself), plus confirmation
> that `prisma migrate status`/`deploy` give zero warning about this specific class of drift — they
> only compare against tracked history, never against what the live schema actually contains. A
> repo-wide audit (introspect every environment's real schema, diff against `schema.prisma` directly
> rather than via migration history) would proactively catch further instances of exactly this
> pattern before they reach a live-production incident like today's.
> **Cleaned up, not left lying around:** the disposable shadow database, all throwaway diagnostic
> scripts, `prisma.production-check.config.ts`, and `.env.production.local` (the file holding the
> real production connection string) were all deleted from disk once the fix was confirmed working
> — nothing with production credentials was left behind, committed, or ever appeared in this
> session's own chat transcript.
> **Artifacts:** `lib/auth/auth-options.ts` (unchanged from the entry above — kept, since the
> apex/www cookie-domain sharing is still correct hardening even though it wasn't the active cause
> here), `prisma/migrations/20260830020000_backfill_marketing_assets/migration.sql` (new),
> `prisma/migrations/20260901062245_add_user_profile_column/migration.sql` (from the entry above,
> now confirmed as the actual fix), this file. Both migrations committed and pushed
> (`de40dc05`, `b5d34b7c`).

> **Ad-hoc session (2026-09-01, same day, phase/session unchanged):** Davin reported a follow-on
> bug found while verifying the OAuth fix above — the `/login` "Already Signed In" screen's Sign
> Out button rolled back to the same screen no matter how many times it was clicked, and asked
> whether the other `FIXED_TEST_ACCOUNTS` (pro-test, admin-test, affiliate-test, etc.) had the same
> problem. Outside the Session 14-x playbook numbering entirely, per `EXECUTOR-PROTOCOL.md` §6.
> **Two compounding, distinct bugs found via live DevTools evidence Davin captured (Network +
> Application tabs), not guessed:**
>
> 1. `app/(auth)/login/page.tsx` and `app/(auth)/verify-2fa/page.tsx`'s "already signed in" Sign Out
>    buttons only ever called `next-auth/react`'s `signOut()` — every other sign-out call site in
>    the app (`app-header.tsx`, `chat-sidebar.tsx`, `affiliate-nav.tsx`) already additionally calls
>    `/api/auth/token-logout` (bridge-aware, gated on `isAuthBridgeEnabled()` — confirmed live and
>    active in production, per Session 4B-21's own cutover). `signOut()` alone leaves the
>    operation-service refresh-token cookie untouched, and — the actual cause of the "rolls back to
>    the same screen" symptom — it can only clear a cookie matching its _current_ config's exact
>    `Domain` scope. Any session cookie set before this same day's earlier `Domain=.davintrade.app`
>    fix was host-only (no `Domain` attribute) — a browser treats that as a genuinely different
>    cookie from the new domain-scoped one, so `signOut()` correctly cleared the new cookie every
>    time while the pre-existing host-only one (still cryptographically valid for up to 30 days)
>    kept getting sent and read as an active session. Davin's own Application-tab screenshot showed
>    both `__Secure-next-auth.session-token` rows side by side, one per `Domain` — direct
>    confirmation, not inference. Fixed by bringing both screens in line with the established
>    bridge-aware pattern already used everywhere else.
> 2. **A second, pre-existing bug found only because fix #1 required actually reading
>    `token-logout/route.ts` closely:** it cleared cookies via `cookieStore.delete(name)`, which
>    Next.js's `ResponseCookies.delete()` builds without a `Secure` attribute (confirmed by reading
>    `next/dist/compiled/@edge-runtime/cookies/index.js` directly — `delete()` → `set()` →
>    `normalizeCookie()` only defaults `path`, nothing else). Both `SESSION_COOKIE_NAME` and
>    `REFRESH_COOKIE_NAME` are `__Secure-`-prefixed in production, and per the cookie-prefix spec a
>    browser silently rejects an _entire_ Set-Cookie header for a `__Secure-`-prefixed name if
>    `Secure` is missing — meaning this route's cookie clearing has never actually taken effect in
>    production, for any user, since it was created (Session 3-3). The server-side operation-service
>    revocation call still worked correctly (a separate code path, unaffected), so leaked refresh
>    tokens were never reusable — but the cookies themselves lingered client-side indefinitely.
>    Switched to `.set()` using the already-existing `tokenCookieOptions()` helper (the same one
>    that correctly set these cookies in the first place), rather than inventing new options inline.
>    **Verified:** `npx tsc --noEmit` clean; `eslint` clean on all four changed files; the existing
>    `__tests__/api/auth/token-logout.test.ts` suite updated (its 3 affected tests asserted
>    `cookieStore.delete` was called — now assert `.set()` with the correct clearing options) and
>    passes 4/4; full monolith `npm run test:ci` **165/165 suites, 2382/2382 tests** — zero
>    regressions. Local `next dev` confirmed `/login` still renders clean with zero console/server
>    errors post-change. **Not verified by the Executor** — the actual authenticated click-through
>    (does Sign Out now redirect to a genuinely logged-out `/login` for a real session): the Executor
>    never enters credentials, so this needs Davin's own confirmation post-deploy, same boundary as
>    every other authenticated flow in this file's history. Davin's existing session will still carry
>    the orphaned host-only cookie until the _first_ post-deploy Sign Out click (which will now
>    correctly clear it) or a manual browser cookie clear — flagged directly to Davin, not silently
>    assumed fixed retroactively.
>    **A drive-by non-finding, verified rather than assumed:** while reading `app/(auth)/login/page.tsx`
>    for this fix, a line that appeared as `'\admin'` (backslash) in this Executor's own earlier
>    conversation-transcript read of the file looked like a real bug (would resolve to a bare `admin`
>    string) — re-reading the file directly showed the actual bytes were always `'/admin'` (forward
>    slash); the backslash was a display artifact in how the tool rendered that earlier read, not
>    something in the file. No fix applied; noted here only so a future session doesn't rediscover the
>    same false lead.
>    **Artifacts:** `app/(auth)/login/page.tsx`, `app/(auth)/verify-2fa/page.tsx`,
>    `app/api/auth/token-logout/route.ts`, `__tests__/api/auth/token-logout.test.ts`, this file.
>    Committed and pushed (`946880ab`).

> **Ad-hoc session (2026-09-03, phase/session unchanged):** Davin requested 2 new
> countries/regions (France `FR`/`fr`, South Korea `KR`/`kr`) in the header's "Select Country &
> Region" dropdown, and 3 new display languages (French `fr`, Korean `ko`, Chinese `zh`) on
> `/settings/language`, via a fully-specified task order given directly in chat. Outside the
> Session 14-x playbook numbering entirely, per `EXECUTOR-PROTOCOL.md` §6.
> **Verified against live code before executing, per §0** — the order's own plan matched the
> live tree closely: `app/settings/language/page.tsx`'s `languages` array carried a comment
> ("`fr` and `zh` removed: no backing dictionary... would silently degrade to English forever")
> confirming this order directly closes the exact gap `docs/policies/08-locale-i18n-compliance.md`
> §0 already documented. `middleware.ts`'s country-prefix routing and the header dropdown
> (`app-header.tsx`) both read `SUPPORTED_COUNTRIES`/its derived prefixes dynamically, and the
> client `LocaleProvider` lazy-loads any non-bundled dictionary via `import()` keyed by language
> code — none of those three needed a direct code change once `lib/country-config.ts` and the new
> dictionary files existed.
> **Correctly left untouched, confirmed via live grep before assuming otherwise:** `lib/dlocal/
constants.ts`'s own `DLOCAL_SUPPORTED_COUNTRIES` (9 countries, payment-provider-specific) is a
> completely separate list from `lib/country-config.ts`'s general locale `SUPPORTED_COUNTRIES` —
> dLocal does not support France or South Korea, and this order never asked for payment-provider
> changes, so `lib/dlocal/**`, `components/payments/CountrySelector.tsx`, and `app/checkout/
page.tsx` were deliberately not touched (would be a money-adjacent change needing its own
> explicit sign-off per `CLAUDE.md` non-negotiable #5).
> **A real test-fixture bug found and fixed, not just the order's own asked-for mock update:**
> `__tests__/api/user.test.ts`'s "should return 400 for an unsupported countryCode" test used the
> literal `'FR'` as its example of an unsupported code — now genuinely supported, that request
> correctly started returning 200, failing the old assertion. Swapped the literal to `'XX'`
> (already this repo's convention for an unrecognized/placeholder ISO code). A repo-wide grep for
> stray `'FR'`/`'KR'` literals elsewhere in `__tests__/` found only this one collision;
> `dlocal-payment-flow.test.ts`'s own `'FR'` (asserting dLocal correctly rejects it) is unaffected
> since dLocal's own supported-country list wasn't touched.
> **Verified:** `npx tsc --noEmit` clean on both the monolith and `operation-service` (the schema
> mirror). `npx eslint` clean on every changed file (`next lint`/`npm run lint` still broken per
> `LESSONS-LEARNED.md` L38). Targeted `__tests__/api/user.test.ts` +
> `__tests__/lib/geo/detect-country.test.ts` **52/52** (the latter is generic ISO-header detection,
> unrelated to `SUPPORTED_COUNTRIES` and unaffected either way — run per the order's own ask).
> Full monolith `npm run test:ci` **165/165 suites, 2382/2382 tests** — exact match to the
> locale-i18n-compliance session's own close baseline, zero regressions.
> **Live-verified structurally, not visually — same boundary as every prior session's
> authenticated surfaces:** a local Turbopack `next dev` booted clean with no build/import errors
> from the 3 new dictionary JSON files (a malformed one would fail the build immediately). Every
> route reachable without a session — including `/free`, unexpectedly, which is not in
> `middleware.ts`'s `PROTECTED_PREFIXES` list but still redirects to `/login`, meaning it has its
> own independent auth gate somewhere the same way `app/(dashboard)/layout.tsx` does per
> `LESSONS-LEARNED.md` L17 — bounced to `/login`, so the header's country dropdown and
> `/settings/language` (both auth-gated) could not be visually click-through-verified; the console
> errors observed on the login page itself (Google Fonts fetch failures, `/api/auth/session`
> 404s) are pre-existing local-dev-environment gaps, confirmed unrelated by inspection, not caused
> by this session. A stray `tsc` run against `.next/dev/types/routes.d.ts` while the dev server
> was still live and actively regenerating that file produced a wall of parse errors — confirmed
> as a build-artifact race (not a real code issue) by stopping the server, clearing
> `.next/dev/types/`, and re-running clean.
> **Not built, deliberately:** `docs/policies/08-locale-i18n-compliance.md`'s own §0 prose (which
> narrates the exact `fr`/`zh`-no-dictionary gap this session closes) was left unedited — a
> documentation-maintenance pass beyond this order's explicit scope, flagged here instead.
> **Lesson harvested:** no new lesson added (`LESSONS-LEARNED.md` still at its 40-entry cap,
> nothing here rose above an already-covered `L22`-family pattern: a value used in a test as
> "the unsupported example" going stale the moment the supported set changes).
> **Artifacts:** `lib/country-config.ts`, `lib/preferences/defaults.ts`, `lib/preferences/
geo-locale.ts`, `lib/i18n/locale-resolver.ts`, `operation-service/src/users/users.schemas.ts`
> (commit `9dbd6f03`); new `lib/i18n/dictionaries/{fr,ko,zh}.json` + `lib/i18n/get-dictionary.ts`
> registration + France/South Korea keys added to `en-US.json`/`en-GB.json`/`ar.json` (commit
> `03b7f675`); `app/settings/language/page.tsx` (commit `a5f3b03b`); `__tests__/api/user.test.ts`
> (commit `61f0ac5d`); this file. 4 commits, one per logical group, per
> `EXECUTOR-PROTOCOL.md` §2's "never batch a whole session into one commit."

> **Ad-hoc session (2026-09-03, phase/session unchanged):** Davin requested (a fully-specified
> task order given directly in chat) upgrading `/settings/language`'s Timezone dropdown from a
> hardcoded 13-entry regional list to an "All Round Clock" dropdown covering every standard GMT
> offset from `-12:00` to `+14:00`, standardized `(GMT ±HH:MM) Region/City` labels, and free-text
> search by city/country/GMT offset. Outside the Session 14-x playbook numbering entirely, per
> `EXECUTOR-PROTOCOL.md` §6.
> **New `lib/utils/timezones.ts`:** `getAllTimezones()` prefers `Intl.supportedValuesOf('timeZone')`
> (live-verified in a real browser — resolves 419 real IANA identifiers) with a ~90-zone curated
> fallback (every standard offset `-12:00`..`+14:00`) for environments lacking that API; sorted by
> offset then alphabetically by identifier, exactly per spec. `tsconfig.json`'s `lib` is pinned to
> `ES2020` (no `ES2022.Intl`), so referencing `Intl.supportedValuesOf` needed an `Intl as unknown as
{...}` cast to satisfy `tsc` — a real compiler finding, not a style choice. 100% backward-compatible
> with stored preferences by construction: every legacy value (`America/New_York`, `Asia/Dubai`,
> `Asia/Seoul`, etc.) is a real IANA identifier already present in the full ICU list.
> **A real architectural risk checked before shipping the order's literal JSX, not assumed safe:**
> the order's own Step 2 nests a raw `<input>` inside `components/ui/select.tsx`'s
> `<SelectContent>` — that component wraps `@radix-ui/react-select` (confirmed by reading it
> directly), not a `cmdk`-based combobox, and Radix `Select.Content` owns its own keyboard-driven
> typeahead/roving-focus — a well-known conflict source for an embedded search input. The order's
> own `onKeyDown`/`onClick` `stopPropagation()` calls anticipated exactly this risk; rather than
> trust that the mitigation works, live-verified it in a real browser via a temporary,
> non-authenticated throwaway route (`app/dev-tz-preview/page.tsx`, deliberately placed outside
> `app/settings/` to route around its `layout.tsx`'s own server-side `getServerSession`+`redirect`
> gate — the exact mechanism `LESSONS-LEARNED.md` L17 documents — deleted immediately after use,
> never committed): the dropdown opens, typing "Dubai" filters live from 419 entries to the one
> match with the dropdown staying open (no typeahead hijack), typing a raw offset string (`+05:30`)
> correctly filters by `gmtPrefix` too, clicking a filtered result selects it and updates the
> trigger label, and reopening the dropdown resets the search box. No deviation from the order's
> JSX was needed — confirmed working, not assumed.
> **Verified:** `npx tsc --noEmit` clean; `npx eslint` clean on all changed/new files; new
> `__tests__/lib/utils/timezones.test.ts` **8/8** (offset formatting incl. half/quarter-hour zones,
> chronological + alphabetical sort, financial-hub presence, zero duplicates, empty/invalid-input
> fallback); `__tests__/api/user.test.ts` **26/26** unaffected; full monolith `npm run test:ci`
> **166/166 suites, 2390/2390 tests** (165→166 suites, 2382→2390 tests — exactly this session's 1
> new suite/8 new tests, zero regressions elsewhere), exact match to the France/Korea session's own
> close baseline plus this session's own additions.
> **Live-verified structurally for the real page too, not just the throwaway route:** local
> Turbopack `next dev` compiles `app/settings/language/page.tsx` with zero build errors from the
> new `lib/utils/timezones.ts` import; `GET /settings/language` cleanly redirects an unauthenticated
> visitor to `/login?callbackUrl=%2Fsettings%2Flanguage` (200), zero server errors — same
> `app/settings/layout.tsx` auth gate as every other settings page in this file's history.
> **Authenticated click-through not performed** — same "Executor never enters credentials" boundary
> as every prior session; flagged below.
> **Not touched, deliberately:** `docs/policies/08-locale-i18n-compliance.md` — this order only
> changes the timezone list, not the language/currency arrays or `handleSave()`'s locale-write
> path, both already fixed in the 2026-09-01 locale-i18n-compliance session.
> **Lesson harvested:** no new lesson added (`LESSONS-LEARNED.md` still at its 40-entry cap) —
> nothing here rose above an already-covered pattern (L17's route-group/layout-auth-gate mechanism,
> applied here for a new purpose: verifying a third-party UI primitive's real interaction behavior
> in a live browser, not working around test infrastructure).
> **Artifacts:** `lib/utils/timezones.ts` (new), `app/settings/language/page.tsx`,
> `__tests__/lib/utils/timezones.test.ts` (new), `next-env.d.ts` (Next.js dev-server auto-regen,
> per this file's own "This is NOT the Next.js you know" note), this file. 2 commits (utility+test,
> then page wiring), plus this docs commit.

- **Current:** Session 14-3 (Cutover + Runbook, Phase 14 — fourth and last of 4 sessions,
  VERIFY-RETIRE), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-30. **Phase 14
  (Web Chat / Contabo Support Stack) is now COMPLETE.** Flips `NEXT_PUBLIC_SOCKET_CHAT_URL` +
  `CHAT_JWT_SECRET` live in Vercel production, verifies the guest chat journey end-to-end against
  `https://davintrade.app`, authors the CC-G operational runbook, and formally closes the phase.
  Zero application source-code changes (VERIFY-RETIRE, as scoped).
  **CONFIRM found the same L3 status-integrity pattern as the last several sessions, again with no
  corroborating record anywhere:** the order's committed HEAD held only the Executor's raw
  PRE-DRAFT; the DRAFT→APPROVED rewrite and Decision 1's sign-off existed only as an uncommitted
  working-tree diff. Surfaced directly; **Davin explicitly confirmed live in chat, 2026-08-30: "I
  explicitly confirm that I approve the Session 14-3 order and specifically sign off on Decision 1
  (Production Vercel cutover with `NEXT_PUBLIC_SOCKET_CHAT_URL=https://chat-api.davintrade.app`
  and `CHAT_JWT_SECRET`)."** That commit (`61ea9c0b`) is now the corroborating record.
  **A second, distinct CONFIRM finding — live code beat the plan's own claim, per
  `EXECUTOR-PROTOCOL.md` §0:** the order's Rollback Invariant and Journey C originally claimed the
  widget "degrades to static Help pages... and `mailto:`." Live-tested (dev server,
  `NEXT_PUBLIC_SOCKET_CHAT_URL` unset, real browser, before sign-off): false. The widget stays
  mounted site-wide regardless of the env var and falls back to its own in-widget canned-response
  generator (`lib/socket-client.ts:148-199`) — it never touches or redirects to the static help
  pages. Corrected in the order text before Decision 1 was signed off.
  **A genuine deployment-mechanism gap, escalated rather than guessed around:** assumed
  `git push origin main` would auto-trigger a Vercel production build (per `vercel.json`'s
  `ignoreCommand` referencing `VERCEL_GIT_COMMIT_REF`). Pushed the CONFIRMED-order commit
  (`61ea9c0b`); production kept serving a build **older than Session 14-2** for 8+ minutes
  (`GET /api/chat/token` 404'd, no widget rendered on any page checked). No Vercel CLI/dashboard
  access exists in this environment — stopped and asked Davin rather than guess at deploy hooks.
  Davin resolved it by (re-)assigning `davintrade.app` to the correct Vercel project and confirming
  a fresh deployment of `61ea9c0b` had finished; the Executor then re-verified live directly
  (`GET /api/chat/token` → `{"token":null,"url":"https://chat-api.davintrade.app"}`).
  **Journey A (unauthenticated guest) live-verified** on `https://davintrade.app/pricing`
  (substituted for `/help` — see below): a genuine, markdown-formatted Gemini reply — impossible
  from the canned fallback, which is fixed plain-text — came back through the real
  BFF → socket → bot-worker path; zero console/CSP errors.
  **Journey B (authenticated PRO user) NOT verified by the Executor** — requires logging into a
  real production account, which the Executor is categorically prohibited from doing (never enters
  credentials, per standing safety rules). Flagged, not silently skipped; needs Davin's own
  click-through, or a provided test session, before it can be marked verified.
  **Journey C / rollback rehearsal accepted from the local CONFIRM-time proof rather than re-toggled
  live on production** — toggling the env var off in Vercel would require its own full
  build-and-deploy cycle; the degradation mechanism was already proven clean (real browser, dev
  server, zero console errors) before sign-off. Deliberate choice to avoid an unnecessary second
  production build cycle, documented as a deviation, not a skipped check.
  **Unrelated finding, discovered incidentally, not fixed:** `/help` and `/about` 404 on production
  while `/` and `/pricing` return 200 — confirmed unrelated to this session (zero application
  source files shipped before the gap was found). Out of scope for a zero-code-changes
  VERIFY-RETIRE session; flagged for a future session.
  **Baselines re-verified fresh at CONFIRM, before any file changed:** monolith `test:ci`
  **154/154·2265/2265**, `operation-service` **43/43·401/401**, `money-service` **62/62·570/570**
  (1 flake on the full run — `prisma.shutdown.spec.ts`, `LESSONS-LEARNED.md` L24, **7th**
  occurrence — confirmed clean in isolation, `--runInBand`, 7.6s), `railway-gateway`
  **3/3·23/23** — zero drift from Session 14-2's own close. Re-confirmed a second time
  automatically by the pre-push hook's own `test:ci` run (**154/154·2265/2265**, identical) when
  pushing the CONFIRMED order.
  **`migration-cutover-table.md` DOES need an entry** — this is the point the slice becomes
  genuinely traffic-carrying — added: Web Chat Stack, `CUT-OVER`, 2026-08-30, commit `61ea9c0b`.
  **`migration-stack-analysis.md` DOES need an entry** (1 new, 3 modified) — added.
  **`DECISION-LOG.md` needed no flag resolution** (order's own header: "Flags touched: none" — F72
  already resolved at Session 14-0).
  **Lesson harvested:** no new lesson promoted (still at the 40-entry cap) — recurrence notes
  appended to `LESSONS-LEARNED.md`'s **L3** and **L24**. One genuinely new candidate lesson
  surfaced (a `git push` to `main` is not reliable proof a Vercel production deployment actually
  shipped — verify the live commit/build directly before treating a push as a completed cutover
  step) but was not promoted, per the file's own cap rule; noted in `migration-stack-analysis.md`'s
  Session 14-3 entry for the Advisor to consider consolidating or promoting once room exists.
  **Artifacts updated:** `14-3-cutover-and-runbook.migration-order.md` (Status → CONFIRMED →
  CLOSED SUCCESSFUL, full CONFIRM Evidence + Deviations, checked Entry-criteria/Done-when boxes),
  `docs/runbooks/contabo-chat-stack.md` (new, CC-G), `migration-cutover-table.md`,
  `migration-stack-analysis.md`, `LESSONS-LEARNED.md`,
  `davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md` (factual anchors refreshed —
  Phase 14 close, fresh baselines, flagged new Stack D architecture material pending Advisor
  review; full planning re-draft deliberately not attempted, out of Executor scope), this file
  (Current/Previous rotation — Session 14-1 moved to `history/sessions-archive.md`).
- **Previous:** Session 14-2 (Frontend Binding, Phase 14 — third of 4 sessions, PORT), APPROVED,
  CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-30. Ports the Support Centre chat widget
  from `seed-code/trading-conversational-ai-ui-pages-increment/` into the main repo (a new BFF
  chat-token endpoint, the socket client, and 3 chat-widget components), wires it against Session
  14-1's live Contabo backend, adds the CSP `connect-src` entries, and mounts it site-wide via
  `client-providers.tsx`. Session 14-3 can now perform the production cutover.
  **CONFIRM found the same L3 status-integrity pattern as the last several sessions, again with no
  corroborating record anywhere:** the order's committed HEAD held only the Executor's raw
  PRE-DRAFT; the full DRAFT→APPROVED rewrite (`Decisions taken`, checked Entry criteria) existed
  only as an uncommitted working-tree diff, with no independent confirmation anywhere in this file
  or `DECISION-LOG.md`. Surfaced directly; **Davin explicitly confirmed live in chat, 2026-08-30:
  "I explicitly confirm that I approve the Session 14-2 order and specifically sign off on
  Decision 1 (BFF chat token minting endpoint `GET /api/chat/token`, signing short-lived JWTs with
  `CHAT_JWT_SECRET`, with guest mode returning `{ token: null }` with HTTP 200)."**
  **Entry criterion 3 (`CHAT_JWT_SECRET` present for local/Vercel) failed at first check —** a
  value-blind grep (per L4/L17) of `.env`/`.env.local`/`.env.example` found zero matches. Davin
  then pasted the real value (generated Session 14-1 Step 3) in plaintext chat — the same exposure
  class as Session 14-1's VPS root password, flagged for Davin's own rotation decision — written
  directly to the gitignored `.env.local` (confirmed untracked) and never echoed into any tool
  output, commit, or document.
  **A real, evidence-based deviation from the seed source, not scope creep:** `lib/socket-client.ts`
  uses Session 14-0's frozen `io()` handshake options exactly (`reconnectionAttempts: 5,
  reconnectionDelay: 1000`) instead of the seed's own `reconnectionAttempts: 3, timeout: 5000,
  autoConnect: false` — the seed pre-dates the frozen contract and was never itself connected to a
  real backend; its `autoConnect: false` would have silently prevented any live connection.
  **Live-verified end-to-end in a real browser, not assumed:** the floating trigger renders, opens,
  and connects over WSS to `chat-api.davintrade.app`; a message sent as a guest ("testing the live
  chat connection") received a genuine, contextual Gemini reply ("Your live chat connection is
  working perfectly...") after a real typing-indicator period — not the canned offline fallback
  text — with zero console errors and zero CSP violations. `/help` was independently confirmed to
  render cleanly alongside the globally-mounted widget.
  **Baselines re-verified fresh at CONFIRM, before any file changed:** monolith `test:ci`
  **151/151·2239/2239**, `operation-service` **43/43·401/401**, `money-service` **62/62·565/565**
  (one `prisma.shutdown.spec.ts` timeout in the full run, confirmed clean in isolation —
  `LESSONS-LEARNED.md` L24, 6th occurrence, not a regression), `railway-gateway` **3/3·23/23** —
  exact match to Session 14-1's close, zero drift.
  **Re-verified again at CLOSE, after all session changes landed:** monolith `test:ci`
  **154/154 suites, 100% tests passing** (3 new suites, 15 new tests) across two consecutive clean
  runs — zero failures either time, though the non-new-test count wobbled by one (2264 vs 2265)
  between runs for reasons confirmed unrelated to this session's own files (cross-checked: no
  pre-existing test references any of the new modules) — noted in the order's Deviations, not
  investigated further since nothing failed either run.
  **`migration-cutover-table.md` needs no changes** — `NEXT_PUBLIC_SOCKET_CHAT_URL` was written
  only to local `.env.local`, never to Vercel production; the widget is built, tested, and
  live-verified against the real backend but is not yet traffic-carrying in production, which is
  explicitly Session 14-3's job. **`migration-stack-analysis.md` DOES need an entry** (8 new, 4
  modified) — added. **`DECISION-LOG.md` needed no flag resolution** (order's own header: "Flags
  touched: none" — F72 was already resolved at Session 14-0).
  **Lesson harvested:** no new lesson (still at the 40-entry cap) — `LESSONS-LEARNED.md`'s L3
  recurrence count updated (now 32+ occurrences through this session); also backfilled a missing
  Session 14-1 note in the file's own header narrative (L45 added, L29+L32 merged) that Session
  14-1's close never wrote in, found while updating the count line for this session.
  **Found, not fixed (out of scope for this PORT session):** `app/(marketing)/help/page.tsx` still
  shows `support@davintrade.com` in its rendered copy — a pre-existing leftover from Session
  9-0/14-0's domain correction that never propagated to this page's content.
  **Artifacts updated:** `14-2-frontend-binding.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, full Deviations, checked Entry-criteria/Done-when boxes), `app/api/chat/token/
route.ts`, `lib/socket-client.ts`, `components/chat-widget/*` (3 files), 3 new test files,
  `next.config.js`, `components/providers/client-providers.tsx`, `.env.example` (documented keys,
  no values), `migration-stack-analysis.md`, `LESSONS-LEARNED.md`,
  `docs/migration-orders/14-3-cutover-and-runbook.migration-order.md` (PRE-DRAFTed, fast-path
  eligible), this file (Current/Previous rotation — Session 14-0 moved to
  `history/sessions-archive.md`).

## Waiting on

- **All Round Clock timezone dropdown — authenticated click-through not yet confirmed**
  (2026-09-03 ad-hoc session) — `tsc`/`eslint`/new-test (8/8)/full `test:ci` (166/166 · 2390/2390)
  all clean, and the real search/select interaction was live-verified in a browser via a temporary
  unauthenticated throwaway route (deleted after use) — but `/settings/language` itself is
  auth-gated, so needs Davin's own pass to confirm: the Timezone field shows the correct
  `(GMT ±HH:MM)` label for the user's saved preference on load, the search box filters as expected
  inside the real page's styling/positioning, selecting a new zone updates the "Current time"
  preview live, and Save persists it correctly.
- **France/South Korea + French/Korean/Chinese — authenticated click-through not yet confirmed**
  (2026-09-03 ad-hoc session) — `tsc`/`eslint`/full `test:ci` (165/165 · 2382/2382) all clean, and
  a local dev server booted with zero build errors, but the header's "Select Country & Region"
  dropdown and `/settings/language` are both auth-gated (confirmed even `/free` redirects to
  `/login` despite not being in `middleware.ts`'s own protected-prefix list) — the Executor never
  authenticates, so needs Davin's own pass to confirm: the header shows `🇫🇷 France €` /
  `🇰🇷 South Korea ₩` and switching to either actually re-locales the app; the Language & Region
  page offers French/Korean/Chinese and each renders its own dictionary with zero console/
  hydration errors. Separately, `ar.json` is still missing a translated country name for every
  `SUPPORTED_COUNTRIES` entry except France/South Korea (added this session) — a pre-existing gap
  from the UAE ad-hoc session, not introduced here, flagged for a future pass.
- **Sign-out fix — live click-through not yet confirmed** (2026-09-01 ad-hoc session) — fixed
  `/login` and `/verify-2fa`'s "already signed in" Sign Out buttons plus a second, independent bug
  in `token-logout/route.ts` (cookie clearing silently failing in production, `__Secure-` prefix +
  missing `Secure` attribute). `tsc`/`eslint`/full `test:ci` all clean, but the Executor never
  authenticates, so the actual "does Sign Out now work" click-through needs Davin. His existing
  Free Test User session will still carry the pre-fix orphaned cookie until the _first_ post-deploy
  Sign Out click or a manual browser cookie clear — not automatically resolved by the deploy alone.
  Also needs a pass across the other `FIXED_TEST_ACCOUNTS` (pro-test, admin-test, affiliate-test,
  etc.) Davin asked about — the fix isn't account-specific, but wasn't verified against each one.
- **RESOLVED 2026-09-01:** OAuth `error=Callback` — see the two same-day ad-hoc entries above.
  Root cause was untracked schema drift (`User.profile`, then a second layer:
  `MarketingAsset`/`MarketingAssetStatus`/`MarketingAssetCategory`), not the apex/www cookie theory
  the first entry chased — that fix stayed in as valid hardening but wasn't the active cause.
  Davin confirmed live, in his own browser, that both Google and Twitter/X sign-in now work.
  **LinkedIn was never actually tested** (Davin's original report and every live check this session
  ran only covered Google/Twitter/X) — flagged in case it still needs its own confirmation pass.
- **BI dashboard authenticated visual verification** — the new `/admin/dashboards/*` suite
  (2026-08-31 ad-hoc session) is verified structurally (routes compile, RBAC redirect works,
  raw SQL runs clean against live data) but not visually as a logged-in admin — needs Davin's own
  click-through (dev server left running) to confirm chart rendering, dark/light theming, and
  real dashboard content, since the Executor cannot enter credentials even for the dev login
  page's test-account autofill buttons.
  **FX-rate placeholder concern in `lib/admin/analytics/jurisdictions.ts` resolved same session:**
  Davin clarified dLocal never supported `HK`/`TW`/`KR` — those customers already pay via Stripe
  in USD, which doesn't change the merged-revenue logic (dLocal `Payment` rows simply never exist
  for those 3 countries) but does mean Taiwan's TWD threshold is the one rate that actually drives
  a real compliance decision (Taiwan-sourced revenue is assessed in TWD regardless of billing
  currency); `HK`'s rate is provably dead code (`thresholdKind: 'NONE'` never reads it) and `KR`'s
  only feeds a cosmetic display figure (zero-threshold, no math depends on it). All 17 jurisdictions'
  `approxUsdFxRate` values were refreshed from a live, dated snapshot (exchangerate-api.com,
  2026-08-31) rather than left as mixed workbook/reused-config/guessed figures — several were
  > 10% stale (`TRY` had moved ~33%). Still static reference constants, not live-fetched; **needs
  > periodic re-snapshotting** (no automated refresh exists), which is the one genuinely open item
  > here now, not missing sourcing.
- **Phase 12 handover prompt full re-draft** — Session 14-3 refreshed its factual anchors only
  (Phase 14 close, fresh baselines) and flagged that new Stack D architecture material landed
  2026-08-30 (`davintrade-stack-d-and-e/`, commit `64222ef4` — a `DUAL-RAG-SYSTEM-ARCHITECTURE.md`,
  two versioned storage-strategy docs, a `-V2.md` Stack D architecture variant). The Advisor must
  resolve whether these supersede the file the handover prompt's `<CANONICAL_DOCUMENTS>` still
  cites before Session 12-0 drafts against it.
- **Journey B (authenticated PRO user) chat verification** — not run against production; needs
  Davin's own login click-through on `https://davintrade.app` (or a provided test session), since
  the Executor cannot enter credentials itself.
- **`/help` and `/about` 404 on production** — found live during Session 14-3, confirmed unrelated
  to the chat cutover (zero application source changes shipped before the gap was found). Needs its
  own investigation session.
- **DavinTrade Academy live browser verification — `/academy` and `/academy/[id]` RESOLVED
  2026-09-01** (locale-i18n-compliance ad-hoc session): both live-verified in a real browser
  (Arabic, `dir="rtl"`, translated chrome, zero console/server errors) once a dev server was free.
  `/admin/tutorials` still needs Davin's own click-through — same "cannot log in as admin" boundary
  as everything else below.
- **Authenticated click-through for the locale-i18n-compliance session's 8 auth-gated pages**
  (2026-09-01 ad-hoc session) — `/settings/language`, `/admin/dashboards/*` (5 dashboards),
  `/settings/billing`, `/affiliate/dashboard/commissions`, `/admin/affiliates/[id]`,
  `/admin/tutorials`, and `/checkout` (mounts `CountrySelector`/`PaymentMethodSelector`/
  `PriceDisplay`) all compile and redirect cleanly for an unauthenticated visitor (zero server
  errors) but were not click-through-verified as a logged-in user — same "Executor never enters
  credentials" boundary as the BI dashboards and Academy items above. Needs Davin's own pass to
  confirm: the Settings→Language page's Save actually flips live app context and survives reload;
  the 5 BI dashboards, billing/invoice history, and affiliate commissions/admin pages render
  correctly with a non-English locale selected (`ar`/`th`); the checkout page's country/payment
  selectors and price display localize as expected.
- **`20260214000000_rag_dual_memory` migration still pending** — confirmed still sitting
  unapplied in `prisma/migrations/` as of the 2026-08-31 Academy ad-hoc session (found via `prisma
migrate status`, left untouched, see that session's entry above for detail). This is concrete,
  on-disk evidence for the "Phase 12 handover prompt" item directly below — the Stack D RAG
  architecture material's actual migration SQL exists and is ready to apply, still awaiting the
  Advisor's resolution of whether it supersedes the handover prompt's canonical documents.

## Key documents

| What                                                                                                    | Where                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Master roadmap (Phases 7–15)**                                                                        | `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md` **(new 2026-08-20 — read at OPEN)** |
| Operating manual (YOUR rules)                                                                           | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)                                                                          | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.3) |
| Session playbook                                                                                        | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates                                                                                 | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                                                                                            | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN)                                                                    | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                                                                                           | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                                                                                          | `docs/migration-orders/migration-stack-analysis.md`                                       |
| Locale/i18n compliance — incl. §0 CRITICAL Settings-page bug (read before building ANY new frontend UI) | `docs/policies/08-locale-i18n-compliance.md`                                              |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
   _(2026-08-20: Phase 7 is CLOSED — `lib/api/index.ts` was rewritten at Session 7-1, all
   consumers migrated at Session 7-2, and `stackA`/`stackB` retired entirely at Session 7-3. The
   module now strictly exports the generated `operationApi`/`moneyApi` client surface.)_
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**
7. **The Advisor decides from documents; you decide from live code — and you are the role that
   asks.** (Binding from 2026-08-11; full rule `00-SKELETON-AND-RULES.md` §1.0,
   `EXECUTOR-PROTOCOL.md` §0; recorded as `DECISION-LOG.md` **PD1**.) Orders now arrive
   carrying a **`Decisions taken`** section — the Advisor resolves judgment calls itself rather
   than sending questions back to Davin, and Davin's `APPROVED` is the review point. Read that
   section first at CONFIRM. **Do not re-open a settled choice on preference — but always
   re-open it on evidence: when the plan and the live code disagree, live code wins.** You hold
   the evidence the Advisor structurally cannot see, so your escalations are the system's error
   correction, not an interruption of it. An item marked `⚠ NEEDS EXPLICIT SIGN-OFF` is **not**
   covered by Davin's general approval of the order — confirm it separately.

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
